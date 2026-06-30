import { useCallback, useEffect, useRef } from "react";

import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";

import type { SiteCoordinates, ValidatedLocation } from "@/lib/geolocation";
import { calculateDistance } from "@/lib/geolocation";
import { supabase } from "@/lib/supabase";

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

async function notifyAutomaticCheckout(siteName: string | null) {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;

  await ensureShiftNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Turno cerrado automáticamente",
      body: siteName
        ? `Detectamos que te alejaste de ${siteName}. Registramos tu salida automática.`
        : "Detectamos que te alejaste de la sede. Registramos tu salida automática.",
      sound: true,
      data: {
        type: "shift_auto_checkout",
      },
    },
    trigger: null,
  });
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
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
  loadTodayAttendance,
  getAttendanceSource,
}: UseShiftDepartureTrackingArgs) {
  const departureEventInFlightRef = useRef(false);
  const departureLastCheckAtRef = useRef(0);
  const departureLoggedShiftKeyRef = useRef<string | null>(null);
  const departureAutoCheckoutNotifiedShiftRef = useRef<string | null>(null);

  useEffect(() => {
    if (attendanceStatus !== "checked_in") {
      departureLoggedShiftKeyRef.current = null;
      departureAutoCheckoutNotifiedShiftRef.current = null;
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
        !Number.isFinite(location.longitude)
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

      const checkInDate = new Date(lastLog.occurred_at);
      if (!Number.isFinite(checkInDate.getTime()) || !isSameLocalDay(checkInDate, new Date(now))) {
        return;
      }

      const shiftKey = `${lastLog.site_id}|${lastLog.occurred_at}`;
      if (departureLoggedShiftKeyRef.current === shiftKey) return;
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
      const isOutside =
        distanceMeters + accuracy >= departureThresholdMeters;
      if (!isOutside) return;

      departureEventInFlightRef.current = true;
      try {
        const occurredAtIso = new Date(
          Math.min(location.timestamp ?? now, now),
        ).toISOString();
        let data: unknown = null;
        let error: unknown = null;

        const autoCloseResult = await supabase.rpc(
          "register_shift_departure_event_autoclose",
          {
            p_site_id: lastLog.site_id,
            p_distance_meters: Math.round(distanceMeters),
            p_accuracy_meters: Math.round(accuracy),
            p_source: getAttendanceSource(),
            p_notes: null,
            p_occurred_at: occurredAtIso,
            p_auto_checkout_threshold_meters: departureThresholdMeters,
          },
        );
        data = autoCloseResult.data;
        error = autoCloseResult.error;

        const errorMsg = String((error as any)?.message ?? "").toLowerCase();
        if (
          error &&
          errorMsg.includes(
            "function public.register_shift_departure_event_autoclose",
          )
        ) {
          const fallbackResult = await supabase.rpc(
            "register_shift_departure_event",
            {
              p_site_id: lastLog.site_id,
              p_distance_meters: Math.round(distanceMeters),
              p_accuracy_meters: Math.round(accuracy),
              p_source: getAttendanceSource(),
              p_notes: null,
              p_occurred_at: occurredAtIso,
            },
          );
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) {
          console.warn(
            "[ATTENDANCE] No se pudo registrar evento de salida de sede:",
            error,
          );
          return;
        }

        const payload = (data as {
          inserted?: boolean;
          reason?: string | null;
          auto_checkout_applied?: boolean;
          auto_checkout_reason?: string | null;
        } | null) ?? null;

        const autoCheckoutApplied = payload?.auto_checkout_applied === true;
        if (autoCheckoutApplied) {
          departureLoggedShiftKeyRef.current = shiftKey;
          if (departureAutoCheckoutNotifiedShiftRef.current !== shiftKey) {
            departureAutoCheckoutNotifiedShiftRef.current = shiftKey;
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            );
            void notifyAutomaticCheckout(lastLog.site_name);
            Alert.alert(
              "Turno cerrado automáticamente",
              "Detectamos que te alejaste de la sede durante un turno activo. Se registró salida automática.",
            );
          }
          await loadTodayAttendance();
          return;
        }

        if (payload?.reason === "no_open_shift" || payload?.reason === "on_break") {
          departureLoggedShiftKeyRef.current = shiftKey;
          return;
        }

        if (payload?.reason === "already_recorded") {
          console.warn(
            "[ATTENDANCE] Evento de salida ya existía pero aún no hubo auto check-out. Seguimos monitoreando.",
          );
          return;
        }

        if (payload?.inserted && !autoCheckoutApplied) {
          console.warn(
            "[ATTENDANCE] Evento de salida registrado sin auto check-out aplicado. Se reintentará automáticamente.",
          );
        }
      } catch (err) {
        console.warn("[ATTENDANCE] Error registrando salida de sede:", err);
      } finally {
        departureEventInFlightRef.current = false;
      }
    },
    [
      attendanceStatus,
      departureMaxAccuracyMeters,
      departureMinCheckIntervalMs,
      departureThresholdMeters,
      getAttendanceSource,
      getLastAttendanceLog,
      isEmployeeActive,
      isOnBreak,
      loadTodayAttendance,
      resolveSite,
      userId,
    ],
  );

  return {
    registerOpenShiftDepartureEvent,
  };
}
