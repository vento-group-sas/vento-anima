import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type AttendancePolicy = {
  geofence_check_in_max_accuracy_meters: number
  geofence_check_out_max_accuracy_meters: number
  late_tolerance_minutes: number
  geofence_ready_cache_ms: number
  geofence_latch_ttl_checkin_ms: number
  geofence_latch_ttl_checkout_ms: number
  shift_departure_max_accuracy_meters: number
  shift_departure_threshold_meters: number
  shift_departure_min_check_interval_ms: number
  default_radius_meters: number | null
}

const DEFAULT_POLICY: AttendancePolicy = {
  geofence_check_in_max_accuracy_meters: 25,
  geofence_check_out_max_accuracy_meters: 25,
  late_tolerance_minutes: 15,
  geofence_ready_cache_ms: 120000,
  geofence_latch_ttl_checkin_ms: 15 * 60 * 1000,
  geofence_latch_ttl_checkout_ms: 10 * 60 * 1000,
  shift_departure_max_accuracy_meters: 35,
  shift_departure_threshold_meters: 200,
  shift_departure_min_check_interval_ms: 45000,
  default_radius_meters: null,
}

export function useAttendancePolicy() {
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("attendance_policy")
        .select(
          "geofence_check_in_max_accuracy_meters, geofence_check_out_max_accuracy_meters, late_tolerance_minutes, geofence_ready_cache_ms, geofence_latch_ttl_checkin_ms, geofence_latch_ttl_checkout_ms, shift_departure_max_accuracy_meters, shift_departure_threshold_meters, shift_departure_min_check_interval_ms, default_radius_meters"
        )
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setPolicy({
          geofence_check_in_max_accuracy_meters:
            Number(data.geofence_check_in_max_accuracy_meters) ||
            DEFAULT_POLICY.geofence_check_in_max_accuracy_meters,
          geofence_check_out_max_accuracy_meters:
            Number(data.geofence_check_out_max_accuracy_meters) ||
            DEFAULT_POLICY.geofence_check_out_max_accuracy_meters,
          late_tolerance_minutes:
            Number(data.late_tolerance_minutes) ?? DEFAULT_POLICY.late_tolerance_minutes,
          geofence_ready_cache_ms:
            Number(data.geofence_ready_cache_ms) ?? DEFAULT_POLICY.geofence_ready_cache_ms,
          geofence_latch_ttl_checkin_ms:
            Number(data.geofence_latch_ttl_checkin_ms) ??
            DEFAULT_POLICY.geofence_latch_ttl_checkin_ms,
          geofence_latch_ttl_checkout_ms:
            Number(data.geofence_latch_ttl_checkout_ms) ??
            DEFAULT_POLICY.geofence_latch_ttl_checkout_ms,
          shift_departure_max_accuracy_meters:
            Number(data.shift_departure_max_accuracy_meters) ??
            DEFAULT_POLICY.shift_departure_max_accuracy_meters,
          shift_departure_threshold_meters:
            Number(data.shift_departure_threshold_meters) ??
            DEFAULT_POLICY.shift_departure_threshold_meters,
          shift_departure_min_check_interval_ms:
            Number(data.shift_departure_min_check_interval_ms) ??
            DEFAULT_POLICY.shift_departure_min_check_interval_ms,
          default_radius_meters:
            data.default_radius_meters != null
              ? Number(data.default_radius_meters)
              : null,
        })
      } else {
        setPolicy(DEFAULT_POLICY)
      }
    } catch (e) {
      console.warn("[ATTENDANCE_POLICY] Error loading policy, using defaults:", e)
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
