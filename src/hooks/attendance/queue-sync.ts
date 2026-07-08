import {
  createSupabaseAuthSessionUnavailableError,
  getSupabaseAuthSession,
  supabase,
} from "@/lib/supabase";
import {
  getErrorMessage,
  getRetryDelayMs,
  isLikelyOfflineError,
  isNoActiveBreakError,
  type PendingAttendanceEvent,
  type PendingBreakEvent,
  type SyncResultItem,
} from "@/hooks/attendance/shared";

type RecordDiagnosticError = (stage: "network" | "sync", message: string) => void;

type SyncAttendanceEventOnServerArgs = {
  item: PendingAttendanceEvent;
  insertAttendanceLogWithRetry: (payload: PendingAttendanceEvent["payload"]) => Promise<void>;
};

export async function syncAttendanceEventOnServer({
  item,
  insertAttendanceLogWithRetry,
}: SyncAttendanceEventOnServerArgs): Promise<SyncResultItem> {
  const payloadForRpc = {
    eventId: item.eventId,
    eventType: item.eventType,
    action: item.payload.action,
    siteId: item.siteId,
    occurredAt: item.occurredAt,
    source: item.payload.source,
    notes: item.payload.notes,
    geoSnapshot: item.geoSnapshot,
    deviceInfo: item.payload.device_info,
    ...(item.payload.shift_id ? { shiftId: item.payload.shift_id } : {}),
  };

  try {
    const session = await getSupabaseAuthSession("attendance queue sync");
    if (!session?.user?.id) {
      throw createSupabaseAuthSessionUnavailableError("attendance queue sync");
    }

    const { data, error } = await supabase.rpc("sync_attendance_events", {
      p_events: [payloadForRpc],
    });
    if (error) throw error;
    const first = Array.isArray(data) ? data[0] : data;
    const result = String((first as any)?.result ?? "error").toLowerCase();
    const message = (first as any)?.message ? String((first as any).message) : undefined;
    if (result === "applied" || result === "duplicate" || result === "conflict") {
      return {
        eventId: item.eventId,
        result,
        message,
      };
    }
    return {
      eventId: item.eventId,
      result: "error",
      message: message ?? "Respuesta de sincronización no válida.",
    };
  } catch (error) {
    const msg = String((error as any)?.message ?? error ?? "").toLowerCase();
    if (
      msg.includes("function public.sync_attendance_events") &&
      msg.includes("does not exist")
    ) {
      await insertAttendanceLogWithRetry(item.payload);
      return { eventId: item.eventId, result: "applied" };
    }
    throw error;
  }
}

type RunAttendanceQueueSyncArgs = {
  queue: PendingAttendanceEvent[];
  force?: boolean;
  evaluateDecision: (item: PendingAttendanceEvent) => Promise<
    { kind: "proceed" } | { kind: "drop"; reason: string } | { kind: "conflict"; reason: string }
  >;
  persistQueue: (queue: PendingAttendanceEvent[]) => Promise<void>;
  syncEvent: (item: PendingAttendanceEvent) => Promise<SyncResultItem>;
  recordDiagnosticError: RecordDiagnosticError;
  incrementSyncConflictCount: () => void;
};

export async function runAttendanceQueueSync({
  queue,
  force,
  evaluateDecision,
  persistQueue,
  syncEvent,
  recordDiagnosticError,
  incrementSyncConflictCount,
}: RunAttendanceQueueSyncArgs): Promise<{
  resultQueue: PendingAttendanceEvent[];
  hasSyncedAtLeastOne: boolean;
}> {
  if (queue.length === 0) {
    await persistQueue([]);
    return { resultQueue: [], hasSyncedAtLeastOne: false };
  }

  const now = Date.now();
  const toProcess = queue.map((item) => {
    if ((item.status === "failed" || item.status === "conflict") && !force) return item;
    if (item.nextRetryAt && item.nextRetryAt > now) return item;
    return { ...item, status: "syncing" as const };
  });
  await persistQueue(toProcess);

  let hasSyncedAtLeastOne = false;
  const resultQueue: PendingAttendanceEvent[] = [];

  for (const item of toProcess) {
    if (item.status !== "syncing") {
      resultQueue.push(item);
      continue;
    }

    try {
      const decision = await evaluateDecision(item);
      if (decision.kind === "drop") continue;
      if (decision.kind === "conflict") {
        recordDiagnosticError("sync", decision.reason);
        incrementSyncConflictCount();
        resultQueue.push({
          ...item,
          status: "conflict",
          attempts: item.attempts + 1,
          lastError: decision.reason,
          nextRetryAt: null,
        });
        continue;
      }

      const syncResult = await syncEvent(item);
      if (syncResult.result === "applied" || syncResult.result === "duplicate") {
        hasSyncedAtLeastOne = true;
        continue;
      }
      if (syncResult.result === "conflict") {
        const reason = syncResult.message ?? "Conflicto al sincronizar el evento pendiente.";
        recordDiagnosticError("sync", reason);
        incrementSyncConflictCount();
        resultQueue.push({
          ...item,
          status: "conflict",
          attempts: item.attempts + 1,
          lastError: reason,
          nextRetryAt: null,
        });
        continue;
      }
      throw new Error(syncResult.message ?? "Error al sincronizar evento pendiente.");
    } catch (error) {
      const attempts = item.attempts + 1;
      const offlineLike = isLikelyOfflineError(error);
      recordDiagnosticError(offlineLike ? "network" : "sync", getErrorMessage(error));
      const nextRetryAt = offlineLike ? Date.now() + getRetryDelayMs(attempts) : null;
      resultQueue.push({
        ...item,
        status: offlineLike ? "pending" : "failed",
        attempts,
        lastError: getErrorMessage(error),
        nextRetryAt,
      });
    }
  }

  await persistQueue(resultQueue);
  return { resultQueue, hasSyncedAtLeastOne };
}

type RunBreakQueueSyncArgs = {
  queue: PendingBreakEvent[];
  force?: boolean;
  evaluateDecision: (item: PendingBreakEvent) => Promise<
    { kind: "proceed" } | { kind: "drop"; reason: string } | { kind: "conflict"; reason: string }
  >;
  persistQueue: (queue: PendingBreakEvent[]) => Promise<void>;
  recordDiagnosticError: RecordDiagnosticError;
};

export async function runBreakQueueSync({
  queue,
  force,
  evaluateDecision,
  persistQueue,
  recordDiagnosticError,
}: RunBreakQueueSyncArgs): Promise<{
  resultQueue: PendingBreakEvent[];
  hasSyncedAtLeastOne: boolean;
}> {
  if (queue.length === 0) {
    await persistQueue([]);
    return { resultQueue: [], hasSyncedAtLeastOne: false };
  }

  const now = Date.now();
  const toProcess = queue.map((item) => {
    if ((item.status === "failed" || item.status === "conflict") && !force) return item;
    if (item.nextRetryAt && item.nextRetryAt > now) return item;
    return { ...item, status: "syncing" as const };
  });
  await persistQueue(toProcess);

  let hasSyncedAtLeastOne = false;
  const resultQueue: PendingBreakEvent[] = [];

  for (const item of toProcess) {
    if (item.status !== "syncing") {
      resultQueue.push(item);
      continue;
    }

    try {
      const decision = await evaluateDecision(item);
      if (decision.kind === "drop") continue;
      if (decision.kind === "conflict") {
        recordDiagnosticError("sync", decision.reason);
        resultQueue.push({
          ...item,
          status: "conflict",
          attempts: item.attempts + 1,
          lastError: decision.reason,
          nextRetryAt: null,
        });
        continue;
      }

      const session = await getSupabaseAuthSession("break queue sync");
      if (!session?.user?.id) {
        throw createSupabaseAuthSessionUnavailableError("break queue sync");
      }

      if (item.payload.action === "start") {
        const { error } = await supabase.rpc("start_attendance_break", {
          p_site_id: item.payload.site_id,
          p_source: item.payload.source,
          p_notes: item.payload.notes,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("end_attendance_break", {
          p_source: item.payload.source,
          p_notes: item.payload.notes,
        });
        if (error && !isNoActiveBreakError(error)) throw error;
      }

      hasSyncedAtLeastOne = true;
    } catch (error) {
      const attempts = item.attempts + 1;
      const offlineLike = isLikelyOfflineError(error);
      recordDiagnosticError(offlineLike ? "network" : "sync", getErrorMessage(error));
      const nextRetryAt = offlineLike ? Date.now() + getRetryDelayMs(attempts) : null;
      resultQueue.push({
        ...item,
        status: offlineLike ? "pending" : "failed",
        attempts,
        lastError: getErrorMessage(error),
        nextRetryAt,
      });
    }
  }

  await persistQueue(resultQueue);
  return { resultQueue, hasSyncedAtLeastOne };
}
