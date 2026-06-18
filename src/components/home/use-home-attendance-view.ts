import { useEffect, useMemo, useState } from "react"

import { PALETTE, RGBA } from "@/components/home/theme"
import type { TodayAttendanceSegment } from "@/hooks/attendance/shared"

function formatMinutesLabel(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`
  }
  return `${minutes} min`
}

function formatClock(value: string | null) {
  if (!value) return "--:--"
  const date = new Date(value)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

type TodaySegmentView = {
  id: string
  title: string
  checkIn: string
  checkOut: string
  isOpen: boolean
  siteName: string | null
}

type AttendanceStateLike = {
  status: string
  todayMinutes?: number | null
  snapshotAt?: string | null
  todaySegments?: TodayAttendanceSegment[] | null
  lastCheckIn: string | null
  lastCheckOut: string | null
}

type GeofenceStateLike = {
  status: string
  canProceed: boolean
  requiresSelection: boolean
  isLatchedReady?: boolean
  latchExpiresAt?: number | null
}

type AttendanceViewArgs = {
  attendanceState: AttendanceStateLike
  geofenceState: GeofenceStateLike
  isLoading: boolean
  isCheckActionLocked: boolean
  pendingAttendanceCount: number
  pendingAttendanceSyncingCount: number
  attendanceUxState: string
  attendanceUxMessage: string | null
}

export function useHomeAttendanceView({
  attendanceState,
  geofenceState,
  isLoading,
  isCheckActionLocked,
  pendingAttendanceCount,
  pendingAttendanceSyncingCount,
  attendanceUxState,
  attendanceUxMessage,
}: AttendanceViewArgs) {
  const isCheckedIn = attendanceState.status === "checked_in"
  const isGeoChecking = geofenceState.status === "checking"
  const isGeofenceReady =
    geofenceState.status === "ready" &&
    geofenceState.canProceed &&
    !geofenceState.requiresSelection
  const canRegister =
    !isLoading &&
    isGeofenceReady &&
    !isGeoChecking &&
    !isCheckActionLocked
  const ctaTextColor = canRegister ? PALETTE.porcelain : PALETTE.text
  const ctaSubTextOpacity = canRegister ? 0.9 : 0.7
  const hasPendingAny = pendingAttendanceCount > 0
  const isSyncingAny = pendingAttendanceSyncingCount > 0

  const ctaPrimaryLabel = useMemo(() => {
    if (isLoading || isGeoChecking || isCheckActionLocked) {
      return isGeoChecking ? "Validando ubicación..." : "Registrando..."
    }
    if (attendanceUxState === "ready" && isGeofenceReady) {
      return isCheckedIn ? "Registrar salida" : "Registrar entrada"
    }
    if (hasPendingAny || isSyncingAny) return "Pendiente de sincronización"
    if (attendanceUxState === "blocked") return "Validar ubicación en sede"
    if (attendanceUxState === "failed") return "Reintentaremos automáticamente"
    if (attendanceUxState === "syncing") return "Sincronizando registros pendientes..."
    if (attendanceUxState === "queued") return "Registro guardado. Se sincroniza automáticamente."
    if (attendanceUxState === "checking") return "Validando ubicación..."
    if (attendanceUxMessage) return attendanceUxMessage
    if (!isGeofenceReady) return "Validar ubicación en sede"
    return isCheckedIn ? "Registrar salida" : "Registrar entrada"
  }, [
    attendanceUxMessage,
    attendanceUxState,
    hasPendingAny,
    isCheckActionLocked,
    isCheckedIn,
    isGeofenceReady,
    isGeoChecking,
    isLoading,
    isSyncingAny,
  ])

  const ctaSecondaryLabel = useMemo(() => {
    if (isLoading || isGeoChecking || isCheckActionLocked) return null
    if (attendanceUxState === "blocked") return "Revalidar ubicación"
    if (attendanceUxState === "failed") return "Reintentar ahora"
    if (isSyncingAny) return "Puedes seguir usando la app"
    if (attendanceUxState === "queued") return "Se enviará automáticamente"
    if (!isGeofenceReady) return "Revisar ubicación"
    return isCheckedIn ? "Terminar turno" : "Iniciar turno"
  }, [
    attendanceUxState,
    isCheckActionLocked,
    isCheckedIn,
    isGeofenceReady,
    isGeoChecking,
    isLoading,
    isSyncingAny,
  ])

  const headerOpsPill = useMemo(() => {
    const pendingTotal = pendingAttendanceCount
    if (isSyncingAny) {
      return {
        label: "SYNC",
        bg: "rgba(242, 198, 192, 0.18)",
        border: RGBA.borderRose,
        text: PALETTE.rose,
      }
    }
    if (pendingTotal > 0) {
      return {
        label: `PEND ${pendingTotal}`,
        bg: PALETTE.porcelain2,
        border: PALETTE.border,
        text: PALETTE.neutral,
      }
    }
    return {
      label: "ONLINE",
      bg: PALETTE.porcelain2,
      border: PALETTE.border,
      text: PALETTE.neutral,
    }
  }, [isSyncingAny, pendingAttendanceCount])

  const showHeaderOpsPill = headerOpsPill.label !== "ONLINE"

  const statusUI = useMemo(() => {
    if (attendanceState.status === "checked_in") {
      return {
        label: "En turno",
        hint: "Registro activo",
        tone: "active" as const,
      }
    }
    if (attendanceState.status === "checked_out") {
      return {
        label: "Jornada cerrada",
        hint: "Listo por hoy",
        tone: "done" as const,
      }
    }
    return {
      label: "Sin iniciar",
      hint: "Registra tu entrada",
      tone: "idle" as const,
    }
  }, [attendanceState.status])

  const geofenceUI = useMemo(() => {
    if (geofenceState.status === "ready" && geofenceState.isLatchedReady)
      return { label: "TEMPORAL", highlight: true }
    if (geofenceState.status === "ready")
      return { label: "VERIFICADA", highlight: true }
    if (geofenceState.status === "checking")
      return { label: "VERIFICANDO", highlight: false }
    if (geofenceState.status === "blocked")
      return { label: "BLOQUEADA", highlight: false }
    if (geofenceState.status === "error")
      return { label: "ERROR", highlight: false }
    return { label: "PENDIENTE", highlight: false }
  }, [geofenceState.isLatchedReady, geofenceState.status])

  const geofencePill = useMemo(() => {
    const isBad =
      geofenceState.status === "blocked" || geofenceState.status === "error"
    const isChecking = geofenceState.status === "checking"
    const isReady = geofenceState.status === "ready"

    return {
      bg: isBad
        ? "rgba(226, 0, 106, 0.08)"
        : isReady
          ? RGBA.washRoseGlow
          : PALETTE.porcelain2,
      border: isBad
        ? RGBA.borderPink
        : isReady
          ? RGBA.borderRose
          : PALETTE.border,
      text: isBad
        ? PALETTE.accent
        : isReady
          ? PALETTE.rose
          : isChecking
            ? PALETTE.accent
            : PALETTE.neutral,
    }
  }, [geofenceState.status])

  const [currentTime, setCurrentTime] = useState(Date.now())
  const [latchNow, setLatchNow] = useState(Date.now())

  useEffect(() => {
    if (!isCheckedIn) return
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [isCheckedIn])

  useEffect(() => {
    if (!geofenceState.isLatchedReady || !geofenceState.latchExpiresAt) return
    const timer = setInterval(() => {
      setLatchNow(Date.now())
    }, 30000)
    return () => clearInterval(timer)
  }, [geofenceState.isLatchedReady, geofenceState.latchExpiresAt])

  const latchedRemainingMs = useMemo(() => {
    if (!geofenceState.isLatchedReady || !geofenceState.latchExpiresAt) return null
    return Math.max(0, geofenceState.latchExpiresAt - latchNow)
  }, [geofenceState.isLatchedReady, geofenceState.latchExpiresAt, latchNow])

  const totalMinutes = useMemo(() => {
    const baseMinutes = Math.max(0, Math.round(attendanceState.todayMinutes ?? 0))
    if (!isCheckedIn) return baseMinutes
    if (!attendanceState.snapshotAt) return baseMinutes

    const snapshotMs = new Date(attendanceState.snapshotAt).getTime()
    if (!Number.isFinite(snapshotMs)) return baseMinutes

    const deltaMinutes = Math.max(0, (currentTime - snapshotMs) / 60000)
    return Math.max(0, Math.round(baseMinutes + deltaMinutes))
  }, [
    attendanceState.snapshotAt,
    attendanceState.todayMinutes,
    currentTime,
    isCheckedIn,
  ])

  const todaySegments = useMemo<TodaySegmentView[]>(() => {
    const segments = Array.isArray(attendanceState.todaySegments)
      ? attendanceState.todaySegments
      : []

    return segments.map((segment, index) => {
      return {
        id: segment.id || `${segment.checkIn}_${index}`,
        title: `Tramo ${index + 1}`,
        checkIn: formatClock(segment.checkIn),
        checkOut: segment.isOpen ? "En curso" : formatClock(segment.checkOut),
        isOpen: segment.isOpen,
        siteName: segment.siteName ?? null,
      }
    })
  }, [attendanceState.todaySegments])

  const hoursLabel = formatMinutesLabel(totalMinutes)
  const lastCheckIn = formatClock(attendanceState.lastCheckIn)
  const lastCheckOut = formatClock(attendanceState.lastCheckOut)

  return {
    isCheckedIn,
    isGeoChecking,
    canRegister,
    ctaTextColor,
    ctaSubTextOpacity,
    hasPendingAny,
    isSyncingAny,
    ctaPrimaryLabel,
    ctaSecondaryLabel,
    headerOpsPill,
    showHeaderOpsPill,
    statusUI,
    geofenceUI,
    geofencePill,
    latchedRemainingMs,
    hoursLabel,
    todaySegments,
    lastCheckIn,
    lastCheckOut,
  }
}
