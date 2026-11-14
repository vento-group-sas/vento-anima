import { useCallback, useEffect, useRef } from "react";

import * as Location from "expo-location";
import { Platform } from "react-native";

import { buildValidatedLocationFromRaw } from "@/lib/geolocation";
import type { AttendanceState, GeofenceCheckState, GeofenceMode } from "@/hooks/attendance/shared";

type RefreshGeofence = (args: {
  force?: boolean;
  mode?: GeofenceMode;
  siteId?: string | null;
  location?: ReturnType<typeof buildValidatedLocationFromRaw> | null;
  silent?: boolean;
  source?: "auto" | "user" | "check_action";
}) => Promise<GeofenceCheckState>;

type UseRealtimeGeofenceArgs = {
  attendanceStatus: AttendanceState["status"];
  refreshGeofence: RefreshGeofence;
  registerOpenShiftDepartureEvent: (
    location: ReturnType<typeof buildValidatedLocationFromRaw>,
  ) => Promise<void>;
};

export function useRealtimeGeofence({
  attendanceStatus,
  refreshGeofence,
  registerOpenShiftDepartureEvent,
}: UseRealtimeGeofenceArgs) {
  const realtimeWatchRef = useRef<Location.LocationSubscription | null>(null);
  const watchGenerationRef = useRef(0);
  const lastRealtimeTickRef = useRef(0);
  const refreshGeofenceRealtimeRef = useRef(refreshGeofence);
  const registerOpenShiftDepartureEventRef =
    useRef(registerOpenShiftDepartureEvent);

  useEffect(() => {
    refreshGeofenceRealtimeRef.current = refreshGeofence;
  }, [refreshGeofence]);

  useEffect(() => {
    registerOpenShiftDepartureEventRef.current = registerOpenShiftDepartureEvent;
  }, [registerOpenShiftDepartureEvent]);

  const startRealtimeGeofence = useCallback(async () => {
    // Antes del check-in solo se permiten lecturas puntuales de geocerca.
    if (attendanceStatus !== "checked_in" || realtimeWatchRef.current) return;
    const generation = ++watchGenerationRef.current;

    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted" ||
        (Platform.OS === "android" && permission.android?.accuracy !== "fine")) return;

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled || generation !== watchGenerationRef.current) return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 20,
          mayShowUserSettingsDialog: true,
        },
        (rawLocation) => {
          if (generation !== watchGenerationRef.current) return;
          const now = Date.now();
          if (now - lastRealtimeTickRef.current < 4000) return;
          lastRealtimeTickRef.current = now;

          const validated = buildValidatedLocationFromRaw(rawLocation);
          void refreshGeofenceRealtimeRef.current({
            force: true,
            location: validated,
            silent: true,
            source: "auto",
          }).catch((error) => {
            console.warn("[ATTENDANCE][GEOFENCE] No se pudo actualizar la ubicación:", error);
          });
          void registerOpenShiftDepartureEventRef.current(validated).catch((error) => {
            console.warn("[ATTENDANCE][GEOFENCE] No se pudo verificar salida de sede:", error);
          });
        },
      );
      // El permiso o el turno pudo cambiar mientras se abría el observador.
      if (generation !== watchGenerationRef.current) {
        subscription.remove();
        return;
      }
      realtimeWatchRef.current = subscription;
    } catch (error) {
      console.warn("[ATTENDANCE][GEOFENCE] Servicio GPS no disponible:", error);
    }
  }, [attendanceStatus]);

  const stopRealtimeGeofence = useCallback(() => {
    watchGenerationRef.current += 1;
    if (realtimeWatchRef.current) {
      realtimeWatchRef.current.remove();
      realtimeWatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopRealtimeGeofence();
  }, [stopRealtimeGeofence]);

  useEffect(() => {
    stopRealtimeGeofence();
    if (attendanceStatus === "checked_in") void startRealtimeGeofence();
  }, [attendanceStatus, startRealtimeGeofence, stopRealtimeGeofence]);

  return {
    startRealtimeGeofence,
    stopRealtimeGeofence,
  };
}
