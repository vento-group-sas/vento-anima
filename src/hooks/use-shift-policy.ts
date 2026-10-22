import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type ShiftPolicy = {
  publicationNoticeMinutes: number
  reminderMinutesBeforeShift: number
  maxShiftHoursPerDay: number
  minHoursBetweenShifts: number
  lateGraceMinutes: number
  endReminderMinutesBeforeEnd: number
  autoCheckoutGraceMinutesAfterEnd: number
  endReminderEnabled: boolean
  scheduledAutoCheckoutEnabled: boolean
}

const DEFAULT_POLICY: ShiftPolicy = {
  publicationNoticeMinutes: 0,
  reminderMinutesBeforeShift: 60,
  maxShiftHoursPerDay: 12,
  minHoursBetweenShifts: 0,
  lateGraceMinutes: 5,
  endReminderMinutesBeforeEnd: 5,
  autoCheckoutGraceMinutesAfterEnd: 30,
  endReminderEnabled: true,
  // El procesador no ejecuta cierres por horario, incluso si la columna legada está activa.
  scheduledAutoCheckoutEnabled: false,
}

export function useShiftPolicy() {
  const [policy, setPolicy] = useState<ShiftPolicy | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shift_policy")
        .select(
          "publication_notice_minutes, reminder_minutes_before_shift, max_shift_hours_per_day, min_hours_between_shifts, late_grace_minutes, end_reminder_minutes_before_end, auto_checkout_grace_minutes_after_end, end_reminder_enabled, scheduled_auto_checkout_enabled"
        )
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setPolicy({
          publicationNoticeMinutes:
            Number(data.publication_notice_minutes) ?? DEFAULT_POLICY.publicationNoticeMinutes,
          reminderMinutesBeforeShift:
            Number(data.reminder_minutes_before_shift) ?? DEFAULT_POLICY.reminderMinutesBeforeShift,
          maxShiftHoursPerDay:
            Number(data.max_shift_hours_per_day) ?? DEFAULT_POLICY.maxShiftHoursPerDay,
          minHoursBetweenShifts:
            Number(data.min_hours_between_shifts) ?? DEFAULT_POLICY.minHoursBetweenShifts,
          lateGraceMinutes:
            Number(data.late_grace_minutes) ?? DEFAULT_POLICY.lateGraceMinutes,
          endReminderMinutesBeforeEnd:
            Number(data.end_reminder_minutes_before_end) ??
            DEFAULT_POLICY.endReminderMinutesBeforeEnd,
          autoCheckoutGraceMinutesAfterEnd:
            Number(data.auto_checkout_grace_minutes_after_end) ??
            DEFAULT_POLICY.autoCheckoutGraceMinutesAfterEnd,
          endReminderEnabled:
            data.end_reminder_enabled ?? DEFAULT_POLICY.endReminderEnabled,
          // Reflejar la capacidad real del runtime, no la bandera heredada de BD.
          scheduledAutoCheckoutEnabled: false,
        })
      } else {
        setPolicy(DEFAULT_POLICY)
      }
    } catch (e) {
      console.warn("[SHIFT_POLICY] Error loading policy, using defaults:", e)
      setPolicy(DEFAULT_POLICY)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const effective = policy ?? DEFAULT_POLICY
  return { policy: effective, loaded, refresh: load }
}
