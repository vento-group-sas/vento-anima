import { getShiftDurationMinutes, type ShiftKind } from "./utils";

export type SiteOption = {
  id: string;
  name: string;
  site_type?: string | null;
  type?: string | null;
  operational_visibility?: string | null;
};
export type EmployeeOption = { id: string; full_name: string | null };

export type ShiftFormState = {
  employeeId: string;
  siteId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  notes: string;
  publishNow: boolean;
  showEndAsClose: boolean;
  shiftKind: ShiftKind;
};

export const today = () => new Date().toISOString().slice(0, 10);

export function toTimeInput(value: string) {
  if (!value) return "";
  const part = value.slice(0, 5);
  return part.length === 5 ? part : value;
}

export function validateShiftForm(params: {
  form: ShiftFormState;
  maxShiftHoursPerDay?: number;
  policyLoaded?: boolean;
}) {
  const { form, maxShiftHoursPerDay = 0, policyLoaded = false } = params;

  if (!form.employeeId) return "Elige un empleado.";
  if (!form.siteId) return "Elige una sede.";
  if (!form.shiftDate.trim()) return "Indica la fecha.";
  if (!form.startTime.trim()) return "Indica la hora de inicio.";
  if (!form.endTime.trim()) return "Indica la hora de fin.";

  const start = form.startTime.slice(0, 5);
  const end = form.endTime.slice(0, 5);

  if (end <= start) return "La hora de fin debe ser posterior a la de inicio.";

  const breakMinutes = Math.max(0, parseInt(form.breakMinutes, 10) || 0);
  if (breakMinutes > 480) return "La pausa configurada no puede superar 8 horas.";

  if (policyLoaded && maxShiftHoursPerDay > 0) {
    const durationHours =
      getShiftDurationMinutes({
        shift_date: form.shiftDate,
        start_time: start,
        end_time: end,
        break_minutes: breakMinutes,
      }) / 60;

    if (durationHours > maxShiftHoursPerDay) {
      return `El turno no puede superar ${maxShiftHoursPerDay} horas (según política).`;
    }
  }

  return null;
}
