import type {
  SiteCoordinates,
  ValidatedLocation,
} from "@/lib/geolocation";

export function isLikelyOfflineError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const msg = String(anyErr?.message ?? anyErr).toLowerCase();

  if (msg.includes("network request failed")) return true;
  if (msg.includes("failed to fetch")) return true;
  if (msg.includes("load failed")) return true;
  if (msg.includes("timeout")) return true;
  if (msg.includes("etimedout")) return true;
  if (msg.includes("enotfound")) return true;
  if (msg.includes("econnrefused")) return true;

  const status = anyErr?.status ?? anyErr?.statusCode;
  if (status === 0) return true;

  return false;
}

export function getAttendanceErrorMessage(
  err: unknown,
  action: "check_in" | "check_out",
): string | null {
  if (!err) return null;
  const anyErr = err as any;
  const code = String(anyErr?.code ?? "");
  const message = String(anyErr?.message ?? "");
  const details = String(anyErr?.details ?? "");
  const hint = String(anyErr?.hint ?? "");
  const combined = `${message} ${details} ${hint}`.toLowerCase();

  const mentionsAssigned =
    combined.includes("asignada") || combined.includes("asignado");
  const mentionsSite = combined.includes("sede");
  const mentionsAuth =
    combined.includes("no autorizado") || combined.includes("no autorizada");
  const mentionsCheckIn =
    combined.includes("check-in") || combined.includes("check in");

  if (
    code === "P0001" &&
    action === "check_in" &&
    ((mentionsAssigned && mentionsSite) ||
      (mentionsAuth && mentionsCheckIn))
  ) {
    return "No tienes asignada esta sede.";
  }

  return null;
}

export function isNoActiveBreakError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const message = String(anyErr?.message ?? "").toLowerCase();
  return message.includes("no hay descanso activo");
}

export type AttendanceStatus =
  | "not_checked_in"
  | "checked_in"
  | "checked_out";

export type TodayAttendanceSegment = {
  id: string;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number;
  isOpen: boolean;
  siteId: string | null;
  siteName: string | null;
  source: string | null;
};

export interface AttendanceState {
  status: AttendanceStatus;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
  lastCheckOutSource: string | null;
  lastCheckOutNotes: string | null;
  todayMinutes: number;
  todayBreakMinutes: number;
  todaySegments: TodayAttendanceSegment[];
  isOnBreak: boolean;
  openBreakStartAt: string | null;
  snapshotAt: string | null;
  openStartAt: string | null;
  currentSiteName: string | null;
  currentSiteId: string | null;
}

export interface CheckInOutResult {
  success: boolean;
  error?: string;
  timestamp?: string;
  queued?: boolean;
}

export type GeofenceMode = "check_in" | "check_out";

export interface SiteCandidate {
  id: string;
  name: string;
  distanceMeters: number | null;
  effectiveRadiusMeters: number;
  requiresGeolocation: boolean;
}

export interface GeofenceCheckState {
  status: "idle" | "checking" | "ready" | "blocked" | "error";
  canProceed: boolean;
  mode: GeofenceMode;
  lastUpdateSource?: "auto" | "user" | "check_action";
  siteId: string | null;
  siteName: string | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  effectiveRadiusMeters: number | null;
  message: string | null;
  updatedAt: number | null;
  location: ValidatedLocation | null;
  deviceInfo: Record<string, unknown> | null;
  isLatchedReady?: boolean;
  latchedReason?: "network" | "location" | null;
  latchExpiresAt?: number | null;
  requiresSelection: boolean;
  candidateSites: SiteCandidate[] | null;
}

export type GeofenceLatchState = {
  siteId: string;
  grantedAt: string;
  expiresAt: string;
  distanceMeters: number;
  accuracy: number;
};

export type AttendanceLogRow = {
  action: "check_in" | "check_out";
  occurred_at: string;
  site_id: string;
  source?: string | null;
  notes?: string | null;
  sites?: { name: string | null } | { name: string | null }[] | null;
};

export type AttendanceBreakRow = {
  started_at: string;
  ended_at: string | null;
};

export type AttendanceInsertPayload = {
  employee_id: string;
  site_id: string;
  geofence_site_id?: string | null;
  action: "check_in" | "check_out";
  source: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  device_info: Record<string, unknown> | null;
  notes: string | null;
  occurred_at: string;
  shift_id?: string | null;
};

export type QueueSyncDecision =
  | { kind: "proceed" }
  | { kind: "drop"; reason: string }
  | { kind: "conflict"; reason: string };

export type SyncResultItem = {
  eventId: string;
  result: "applied" | "duplicate" | "conflict" | "error";
  message?: string;
};

export type DiagnosticStage =
  | "gps"
  | "network"
  | "db"
  | "permission"
  | "sync"
  | "queue"
  | "geofence";

export type AttendanceDiagnostics = {
  lastGeofenceDurationMs: number | null;
  lastCheckInDurationMs: number | null;
  lastCheckOutDurationMs: number | null;
  lastSyncDurationMs: number | null;
  lastErrorStage: DiagnosticStage | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  gpsErrorCount: number;
  networkErrorCount: number;
  dbErrorCount: number;
  permissionErrorCount: number;
  syncConflictCount: number;
};

export type AttendanceUxState =
  | "checking"
  | "ready"
  | "queued"
  | "syncing"
  | "failed"
  | "blocked";

export const ATTENDANCE_UX_MESSAGES: Record<AttendanceUxState, string> = {
  checking: "Validando ubicación...",
  ready: "Listo para registrar",
  queued: "Registro guardado. Se sincroniza automáticamente.",
  syncing: "Sincronizando registros pendientes...",
  failed: "No se pudo sincronizar. Reintentaremos automáticamente.",
  blocked: "Debes validar ubicación en sede para registrar sin internet.",
};

export type PendingAttendanceStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "conflict";

export type PendingAttendanceEventType =
  | "check_in"
  | "check_out"
  | "break_start"
  | "break_end";

export type PendingGeoSnapshot = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  distanceMeters?: number;
};

export type PendingAttendanceEvent = {
  id: string;
  eventId: string;
  eventType: PendingAttendanceEventType;
  siteId: string;
  occurredAt: string;
  geoSnapshot: PendingGeoSnapshot | null;
  payload: AttendanceInsertPayload;
  createdAt: string;
  attempts: number;
  status: PendingAttendanceStatus;
  lastError: string | null;
  nextRetryAt: number | null;
};

export type PendingBreakAction = "start" | "end";

export type PendingBreakPayload = {
  action: PendingBreakAction;
  site_id: string | null;
  source: string;
  notes: string | null;
  clientEventId: string;
  queuedAt: string;
};

export type PendingBreakStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "conflict";

export type PendingBreakEvent = {
  id: string;
  payload: PendingBreakPayload;
  createdAt: string;
  attempts: number;
  status: PendingBreakStatus;
  lastError: string | null;
  nextRetryAt: number | null;
};

export const ATTENDANCE_GEOFENCE = {
  checkIn: { maxAccuracyMeters: 25 },
  checkOut: { maxAccuracyMeters: 25 },
};

export const SHIFT_DEPARTURE_TRACKING = {
  thresholdMeters: 200,
  maxAccuracyMeters: 35,
  minCheckIntervalMs: 45000,
};

export const GEOFENCE_READY_CACHE_MS = 120000;
export const SITE_RESOLVE_CACHE_MS = 5 * 60 * 1000;
export const ATTENDANCE_WRITE_MAX_ATTEMPTS = 3;
export const ATTENDANCE_WRITE_BASE_DELAY_MS = 700;
export const ATTENDANCE_RECONCILE_WINDOW_MS = 2 * 60 * 1000;
export const ATTENDANCE_SYNC_INTERVAL_MS = 15000;
export const ATTENDANCE_SYNC_MAX_RETRY_DELAY_MS = 2 * 60 * 1000;
export const GEOFENCE_LATCH_TTL_CHECKIN_MS = 15 * 60 * 1000;
export const GEOFENCE_LATCH_TTL_CHECKOUT_MS = 10 * 60 * 1000;

export function getAttendanceSource(): string {
  return "mobile";
}

export function getAttendanceQueueStorageKey(userId: string): string {
  return `attendance_queue_${userId}`;
}

export function getBreakQueueStorageKey(userId: string): string {
  return `attendance_breakqueue_${userId}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildPendingAttendanceId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildGeoSnapshotFromPayload(
  payload: AttendanceInsertPayload,
  distanceMeters?: number,
): PendingGeoSnapshot | null {
  if (
    payload.latitude == null ||
    payload.longitude == null ||
    payload.accuracy_meters == null
  ) {
    return null;
  }

  return {
    lat: payload.latitude,
    lng: payload.longitude,
    accuracy: payload.accuracy_meters,
    timestamp: Date.parse(payload.occurred_at) || Date.now(),
    distanceMeters,
  };
}

export function buildClientEventId(action: string): string {
  return `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePendingAttendanceEvent(
  raw: any,
): PendingAttendanceEvent | null {
  if (!raw?.id || !raw?.payload) return null;
  const payload = raw.payload as AttendanceInsertPayload;
  if (!payload?.site_id || !payload?.action || !payload?.occurred_at) return null;

  const eventId = String(
    raw.eventId ??
    payload?.device_info?.["clientEventId"] ??
    buildClientEventId(payload.action),
  );
  const eventType = (raw.eventType ?? payload.action) as PendingAttendanceEventType;
  const normalizedStatus: PendingAttendanceStatus =
    raw.status === "syncing" || raw.status === "failed" || raw.status === "conflict"
      ? raw.status
      : "pending";
  const attempts = Number.isFinite(raw.attempts)
    ? Math.max(0, Number(raw.attempts))
    : 0;
  const createdAt =
    typeof raw.createdAt === "string"
      ? raw.createdAt
      : new Date().toISOString();
  const occurredAt =
    typeof raw.occurredAt === "string" ? raw.occurredAt : payload.occurred_at;
  const siteId = typeof raw.siteId === "string" ? raw.siteId : payload.site_id;
  const geoSnapshot: PendingGeoSnapshot | null =
    raw.geoSnapshot && typeof raw.geoSnapshot === "object"
      ? {
        lat: Number(raw.geoSnapshot.lat),
        lng: Number(raw.geoSnapshot.lng),
        accuracy: Number(raw.geoSnapshot.accuracy),
        timestamp: Number(raw.geoSnapshot.timestamp) || Date.now(),
        distanceMeters:
          raw.geoSnapshot.distanceMeters != null
            ? Number(raw.geoSnapshot.distanceMeters)
            : undefined,
      }
      : buildGeoSnapshotFromPayload(payload);

  return {
    id: String(raw.id),
    eventId,
    eventType,
    siteId,
    occurredAt,
    geoSnapshot,
    payload,
    createdAt,
    attempts,
    status: normalizedStatus,
    lastError: raw.lastError ? String(raw.lastError) : null,
    nextRetryAt: typeof raw.nextRetryAt === "number" ? raw.nextRetryAt : null,
  };
}

export function getRetryDelayMs(attempts: number): number {
  const next =
    ATTENDANCE_WRITE_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(next, ATTENDANCE_SYNC_MAX_RETRY_DELAY_MS);
}

export function getErrorMessage(err: unknown): string {
  if (!err) return "Error desconocido";
  const anyErr = err as any;
  return String(anyErr?.message ?? anyErr);
}

export function classifyDiagnosticStage(err: unknown): DiagnosticStage {
  if (isLikelyOfflineError(err)) return "network";
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (msg.includes("permission") || msg.includes("permiso")) return "permission";
  if (
    msg.includes("gps") ||
    msg.includes("ubicacion") ||
    msg.includes("location") ||
    msg.includes("fuera de rango")
  ) {
    return "gps";
  }
  if (
    msg.includes("postgres") ||
    msg.includes("sql") ||
    msg.includes("trigger") ||
    msg.includes("supabase")
  ) {
    return "db";
  }
  return "geofence";
}

export function getGeofenceLatchTtlMs(mode: GeofenceMode): number {
  return mode === "check_in"
    ? GEOFENCE_LATCH_TTL_CHECKIN_MS
    : GEOFENCE_LATCH_TTL_CHECKOUT_MS;
}

export function isLikelyTransientGeoError(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("network") ||
    m.includes("sin conexión") ||
    m.includes("sin conexion") ||
    m.includes("unavailable") ||
    m.includes("temporarily") ||
    m.includes("no se pudo obtener")
  );
}

export function findBlockingGeoWarning(
  location?: ValidatedLocation,
): string | null {
  const warnings = location?.validationWarnings ?? [];
  for (const w of warnings) {
    const s = w.toLowerCase();
    if (
      s.includes("punto nulo") ||
      s.includes("patron sospechoso") ||
      s.includes("digitos repetidos") ||
      s.includes("mock") ||
      s.includes("simulada") ||
      s.includes("spoof")
    ) {
      return w;
    }
  }
  return null;
}

export function buildDeviceInfoPayload(
  location: ValidatedLocation | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!location) return null;
  return {
    ...(location.deviceInfo as any),
    validationWarnings: location.validationWarnings ?? [],
    ...(extra ?? {}),
  };
}

export function asMillis(value: string): number {
  return new Date(value).getTime();
}

export function getOverlapMinutes(
  intervalStartMs: number,
  intervalEndMs: number,
  breaks: Array<{ startMs: number; endMs: number }>,
): number {
  if (intervalEndMs <= intervalStartMs) return 0;
  let total = 0;
  for (const item of breaks) {
    const overlapStart = Math.max(intervalStartMs, item.startMs);
    const overlapEnd = Math.min(intervalEndMs, item.endMs);
    if (overlapEnd > overlapStart) {
      total += (overlapEnd - overlapStart) / 60000;
    }
  }
  return total;
}
