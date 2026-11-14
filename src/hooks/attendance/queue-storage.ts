import * as SecureStore from "expo-secure-store";

import {
  getAttendanceQueueStorageKey,
  getBreakQueueStorageKey,
  getErrorMessage,
  normalizePendingAttendanceEvent,
  type DiagnosticStage,
  type PendingAttendanceEvent,
  type PendingBreakEvent,
} from "@/hooks/attendance/shared";

type RecordDiagnosticError = (
  stage: DiagnosticStage,
  message: string,
) => void;

export async function loadPendingAttendanceQueueFromStorage(
  userId: string,
  recordDiagnosticError: RecordDiagnosticError,
): Promise<PendingAttendanceEvent[]> {
  try {
    const raw = await SecureStore.getItemAsync(getAttendanceQueueStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizePendingAttendanceEvent(item))
      .filter((item): item is PendingAttendanceEvent => item != null);
  } catch (error) {
    console.warn("[ATTENDANCE] No se pudo cargar cola pendiente:", error);
    recordDiagnosticError("queue", getErrorMessage(error));
    return [];
  }
}

export async function persistPendingAttendanceQueueToStorage(
  userId: string,
  queue: PendingAttendanceEvent[],
  recordDiagnosticError: RecordDiagnosticError,
): Promise<void> {
  try {
    const key = getAttendanceQueueStorageKey(userId);
    if (queue.length === 0) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, JSON.stringify(queue));
  } catch (error) {
    console.warn("[ATTENDANCE] No se pudo guardar cola pendiente:", error);
    recordDiagnosticError("queue", getErrorMessage(error));
    // La entrada o salida no esta encolada si SecureStore rechazo la escritura.
    throw error;
  }
}

export async function loadPendingBreakQueueFromStorage(
  userId: string,
  recordDiagnosticError: RecordDiagnosticError,
): Promise<PendingBreakEvent[]> {
  try {
    const raw = await SecureStore.getItemAsync(getBreakQueueStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => !!item?.id && !!item?.payload) as PendingBreakEvent[];
  } catch (error) {
    console.warn("[ATTENDANCE] No se pudo cargar cola de descansos:", error);
    recordDiagnosticError("queue", getErrorMessage(error));
    return [];
  }
}

export async function persistPendingBreakQueueToStorage(
  userId: string,
  queue: PendingBreakEvent[],
  recordDiagnosticError: RecordDiagnosticError,
): Promise<void> {
  try {
    const key = getBreakQueueStorageKey(userId);
    if (queue.length === 0) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, JSON.stringify(queue));
  } catch (error) {
    console.warn("[ATTENDANCE] No se pudo guardar cola de descansos:", error);
    recordDiagnosticError("queue", getErrorMessage(error));
  }
}
