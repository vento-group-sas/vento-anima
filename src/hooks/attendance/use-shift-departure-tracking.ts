import { useCallback, useEffect, useRef } from "react";

import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";

import type { SiteCoordinates, ValidatedLocation } from "@/lib/geolocation";
import { calculateDistance } from "@/lib/geolocation";
import { findBlockingGeoWarning } from "@/hooks/attendance/shared";

const SHIFT_NOTIFICATION_CHANNEL = "shift-alerts";

type LastAttendanceLog = {
  action: "check_in" | "check_out";
  occurred_at: string;
  site_id: string;
  site_name: string | null;
} | null;

type UseShiftDepartureTrackingArgs = {
  userId: string | null | undefined;
  isEmployeeActive: boolean;
  attendanceStatus: "not_checked_in" | "checked_in" | "checked_out";
  isOnBreak: boolean;
  departureMinCheckIntervalMs: number;
  departureMaxAccuracyMeters: number;
  departureThresholdMeters: number;
  getLastAttendanceLog: () => Promise<LastAttendanceLog>;
  resolveSite: (
    siteId: string,
  ) => Promise<{ site: SiteCoordinates | null; hasCoordinates: boolean }>;
  loadTodayAttendance: () => Promise<unknown> | unknown;
  getAttendanceSource: () => string;
};

async function ensureShiftNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(SHIFT_NOTIFICATION_CHANNEL, {
    name: "Alertas de turno",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function notifyDepartureWarning(siteName: string | null) {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;

  await ensureShiftNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Posible salida de sede",
      body: siteName
        ? `Parece que te alejaste de ${siteName}. Tu turno sigue abierto; recuerda registrar la salida cuando termines.`
        : "Parece que te alejaste de la sede. Tu turno sigue abierto; recuerda registrar la salida cuando termines.",
      sound: true,
      data: { type: "shift" },
    },
    trigger: null,
  });
}

export function useShiftDepartureTracking({
  userId,
  isEmployeeActive,
  attendanceStatus,
  isOnBreak,
  departureMinCheckIntervalMs,
  departureMaxAccuracyMeters,
  departureThresholdMeters,
  getLastAttendanceLog,
  resolveSite,
}: UseShiftDepartureTrackingArgs) {
  const departureEventInFlightRef = useRef(false);
  const departureLastCheckAtRef = useRef(0);
  const departureOutsideShiftRef = useRef<string | null>(null);
  const departureOutsideSamplesRef = useRef(0);
  const departureWarningNotifiedShiftRef = useRef<string | null>(null);

  useEffect(() => {
    if (attendanceStatus !== "checked_in") {
      departureOutsideShiftRef.current = null;
      departureOutsideSamplesRef.current = 0;
      departureWarningNotifiedShiftRef.current = null;
    }
  }, [attendanceStatus]);

  const registerOpenShiftDepartureEvent = useCallback(
    async (location: ValidatedLocation) => {
      if (!userId || !isEmployeeActive) return;
      if (attendanceStatus !== "checked_in") return;
      if (isOnBreak) return;
      if (
        !location ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) ||
        !location.isValid ||
        Boolean(findBlockingGeoWarning(location))
      ) {
        return;
      }

      const now = Date.now();
      if (now - departureLastCheckAtRef.current < departureMinCheckIntervalMs) {
        return;
      }
      departureLastCheckAtRef.current = now;

      const accuracy = location.accuracy ?? 999;
      if (accuracy > departureMaxAccuracyMeters) return;

      const lastLog = await getLastAttendanceLog();
      if (!lastLog || lastLog.action !== "check_in") return;

      if (!Number.isFinite(new Date(lastLog.occurred_at).getTime())) return;

      const shiftKey = `${lastLog.site_id}|${lastLog.occurred_at}`;
      if (departureWarningNotifiedShiftRef.current === shiftKey) return;
      if (departureOutsideShiftRef.current !== shiftKey) {
        departureOutsideShiftRef.current = shiftKey;
        departureOutsideSamplesRef.current = 0;
      }
      if (departureEventInFlightRef.current) return;

      const resolved = await resolveSite(lastLog.site_id);
      if (!resolved.site || !resolved.hasCoordinates || !resolved.site.requiresGeolocation) {
        return;
      }

      const distanceMeters = calculateDistance(
        location.latitude,
        location.longitude,
        resolved.site.latitude,
        resolved.site.longitude,
      );
      // Exigir evidencia fuera del umbral incluso descontando la incertidumbre GPS.
      const isOutside = distanceMeters - accuracy >= departureThresholdMeters;
      if (!isOutside) {
        departureOutsideSamplesRef.current = 0;
        return;
      }
      // Evitar alarmas por una lectura aislada: al menos dos muestras separadas
      // por el intervalo mínimo de comprobación configurado.
      departureOutsideSamplesRef.current += 1;
      if (departureOutsideSamplesRef.current < 2) return;

      departureEventInFlightRef.current = true;
      try {
        if (departureWarningNotifiedShiftRef.current !== shiftKey) {
          departureWarningNotifiedShiftRef.current = shiftKey;
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await notifyDepartureWarning(lastLog.site_name);
          Alert.alert(
            "Posible salida de sede",
            "Detectamos que podrías haberte alejado durante tu turno. El turno sigue abierto; registra tu salida manualmente cuando corresponda.",
          );
        }
      } catch (err) {
        console.warn("[ATTENDANCE] No se pudo mostrar aviso de salida de sede:", err);
      } finally {
        departureEventInFlightRef.current = false;
      }
    },
    [
      attendanceStatus,
      departureMaxAccuracyMeters,
      departureMinCheckIntervalMs,
      departureThresholdMeters,
      getLastAttendanceLog,
      isEmployeeActive,
      isOnBreak,
      resolveSite,
      userId,
    ],
  );

  return {
    registerOpenShiftDepartureEvent,
  };
}
