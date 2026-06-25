export type ShiftStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type ShiftKind = "laboral" | "descanso";

export type ShiftRow = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_kind?: ShiftKind | null;
  show_end_as_close?: boolean | null;
  break_minutes: number | null;
  notes: string | null;
  status: ShiftStatus;
  site_id: string;
  area_id?: string | null;
  operational_role?: string | null;
  checkin_site_id?: string | null;
  checkout_site_id?: string | null;
  sites: { name: string | null } | { name: string | null }[] | null;
};

export function getShiftSiteName(
  sites: ShiftRow["sites"],
  fallback = "Sede por confirmar",
) {
  if (!sites) return fallback;
  if (Array.isArray(sites)) return sites[0]?.name ?? fallback;
  return sites.name ?? fallback;
}

export function formatShiftTime(value: string) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

export function buildShiftDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}`);
}

export function getShiftRangeLabel(
  shift: Pick<ShiftRow, "start_time" | "end_time" | "show_end_as_close" | "shift_kind">,
) {
  if (shift.shift_kind === "descanso") return "Descanso";
  return shift.show_end_as_close
    ? `${formatShiftTime(shift.start_time)} - Cierre`
    : `${formatShiftTime(shift.start_time)} - ${formatShiftTime(shift.end_time)}`;
}

export function getShiftDurationMinutes(
  shift: Pick<ShiftRow, "shift_date" | "start_time" | "end_time" | "break_minutes">,
) {
  const startMs = buildShiftDateTime(shift.shift_date, shift.start_time).getTime();
  const endMs = buildShiftDateTime(shift.shift_date, shift.end_time).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((endMs - startMs) / 60000) - Math.max(0, shift.break_minutes ?? 0),
  );
}

export function formatShiftMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${minutes} min`;
}

export function formatShiftDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const weekday = date.toLocaleDateString("es-CO", { weekday: "long" });
  const prettyWeekday = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  const prettyDate = date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
  });
  return `${prettyWeekday} ${prettyDate}`;
}

export function formatShiftShortDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}

export function getShiftStatusMeta(status: ShiftStatus) {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmado",
        bg: "#ECFDF3",
        border: "#A7F3D0",
        text: "#047857",
      };
    case "completed":
      return {
        label: "Completado",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        text: "#1D4ED8",
      };
    case "cancelled":
      return {
        label: "Cancelado",
        bg: "#FEF2F2",
        border: "#FECACA",
        text: "#B91C1C",
      };
    case "no_show":
      return {
        label: "No asistió",
        bg: "#FFF7ED",
        border: "#FED7AA",
        text: "#C2410C",
      };
    case "scheduled":
    default:
      return {
        label: "Programado",
        bg: "#FDF2F8",
        border: "#FBCFE8",
        text: "#BE185D",
      };
  }
}

export function isUpcomingShift(
  shift: Pick<ShiftRow, "shift_date" | "end_time" | "status" | "shift_kind">,
  now = new Date(),
) {
  if (shift.status === "cancelled" || shift.status === "completed" || shift.status === "no_show") {
    return false;
  }

  if (shift.shift_kind === "descanso") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const shiftDate = new Date(`${shift.shift_date}T00:00:00`);
    return shiftDate.getTime() >= today.getTime();
  }

  const endAt = buildShiftDateTime(shift.shift_date, shift.end_time);
  return endAt.getTime() >= now.getTime();
}
