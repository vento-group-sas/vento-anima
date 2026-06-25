import { useCallback, useState } from "react"

import { isUpcomingShift, type ShiftRow } from "@/components/shifts/utils"
import { supabase } from "@/lib/supabase"

function getShiftWindowDate(days: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function useNextScheduledShift(userId: string | null | undefined) {
  const [nextScheduledShift, setNextScheduledShift] = useState<ShiftRow | null>(null)
  const [todayShift, setTodayShift] = useState<ShiftRow | null>(null)
  const [isLoadingNextShift, setIsLoadingNextShift] = useState(false)

  const loadNextScheduledShift = useCallback(async () => {
    if (!userId) {
      setNextScheduledShift(null)
      setTodayShift(null)
      return
    }

    setIsLoadingNextShift(true)
    try {
      const { data, error } = await supabase
        .from("employee_shifts")
        .select(
          "id, shift_date, start_time, end_time, shift_kind, show_end_as_close, break_minutes, notes, status, site_id, area_id, operational_role, checkin_site_id, checkout_site_id, sites(name)",
        )
        .eq("employee_id", userId)
        .not("published_at", "is", null)
        .gte("shift_date", getShiftWindowDate(0))
        .lte("shift_date", getShiftWindowDate(30))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(8)

      if (error) throw error
      const rows = (data ?? []) as ShiftRow[]
      const todayIso = getShiftWindowDate(0)
      const today = rows.find((row) => row.shift_date === todayIso) ?? null
      const upcoming = rows.find((row) => isUpcomingShift(row))
      setTodayShift(today)
      setNextScheduledShift(upcoming ?? null)
    } catch (error) {
      console.error("[HOME] Error loading next shift:", error)
      setNextScheduledShift(null)
      setTodayShift(null)
    } finally {
      setIsLoadingNextShift(false)
    }
  }, [userId])

  return {
    nextScheduledShift,
    todayShift,
    isLoadingNextShift,
    loadNextScheduledShift,
  }
}
