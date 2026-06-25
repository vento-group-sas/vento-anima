import type {
  AttendanceInsertPayload,
  PendingBreakAction,
  PendingBreakPayload,
} from "@/hooks/attendance/shared";

type BuildAttendanceInsertPayloadArgs = {
  employeeId: string;
  siteId: string;
  geofenceSiteId?: string | null;
  action: "check_in" | "check_out";
  source: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  deviceInfo?: Record<string, unknown> | null;
  clientEventId: string;
  occurredAt?: string;
  notes?: string | null;
  shiftId?: string | null;
  extraDeviceInfo?: Record<string, unknown>;
};

export function buildAttendanceInsertPayload({
  employeeId,
  siteId,
  geofenceSiteId,
  action,
  source,
  latitude = null,
  longitude = null,
  accuracyMeters = null,
  deviceInfo = null,
  clientEventId,
  occurredAt,
  notes = null,
  shiftId,
  extraDeviceInfo,
}: BuildAttendanceInsertPayloadArgs): AttendanceInsertPayload {
  const payload: AttendanceInsertPayload = {
    employee_id: employeeId,
    site_id: siteId,
    geofence_site_id: geofenceSiteId ?? siteId,
    action,
    source,
    latitude,
    longitude,
    accuracy_meters: accuracyMeters,
    device_info: {
      ...(deviceInfo ?? {}),
      ...(extraDeviceInfo ?? {}),
      clientEventId,
    },
    notes,
    occurred_at: occurredAt ?? new Date().toISOString(),
  };

  if (shiftId) {
    payload.shift_id = shiftId;
  }

  return payload;
}

type BuildQueuedBreakPayloadArgs = {
  action: PendingBreakAction;
  siteId: string | null;
  source: string;
  clientEventId: string;
  queuedAt?: string;
  notesExtra?: Record<string, unknown>;
};

export function buildQueuedBreakPayload({
  action,
  siteId,
  source,
  clientEventId,
  queuedAt,
  notesExtra,
}: BuildQueuedBreakPayloadArgs): PendingBreakPayload {
  const queuedAtValue = queuedAt ?? new Date().toISOString();

  return {
    action,
    site_id: siteId,
    source,
    notes: JSON.stringify({
      clientEventId,
      queuedAt: queuedAtValue,
      ...(notesExtra ?? {}),
    }),
    clientEventId,
    queuedAt: queuedAtValue,
  };
}
