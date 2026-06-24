export type AttendanceLog = {
  id: string;
  action: "check_in" | "check_out";
  occurred_at: string;
  site_id: string | null;
  sites: { name: string | null } | { name: string | null }[] | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  notes: string | null;
};

export type HistoryStatusLabel =
  | "En curso"
  | "Turno cerrado"
  | "Sin salida"
  | "Sin entrada"
  | "Salida registrada";

export type DerivedLog = AttendanceLog & {
  statusLabel: HistoryStatusLabel;
  durationMinutes: number | null;
  dayKey: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLogId: string | null;
  checkOutLogId: string | null;
  checkInAccuracyMeters: number | null;
  checkOutAccuracyMeters: number | null;
  checkOutNotes: string | null;
};
