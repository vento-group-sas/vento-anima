import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  buildValidatedLocationFromRaw,
  calculateDistance,
} from "@/lib/geolocation";
import { supabase } from "@/lib/supabase";
import { SHIFT_DEPARTURE_TRACKING } from "@/hooks/attendance/shared";

export const ATTENDANCE_BACKGROUND_LOCATION_TASK =
  "anima-attendance-background-location";

type AttendanceLastLog = {
  action: "check_in" | "check_out";
  occurred_at: string;
  site_id: string;
  geofence_site_id?: string | null;
  sites?: { name: string | null } | { name: string | null }[] | null;
};

type SiteRow = {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  requires_geofence?: boolean | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isValidCoordinate(latitude: unknown, longitude: unknown) {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

async function handleBackgroundLocation(rawLocation: Location.LocationObject) {
  const validated = buildValidatedLocationFromRaw(rawLocation);
  if (
    !validated ||
    !Number.isFinite(validated.latitude) ||
    !Number.isFinite(validated.longitude)
  ) {
    return;
  }

  const accuracy = validated.accuracy ?? 999;
  if (accuracy > SHIFT_DEPARTURE_TRACKING.maxAccuracyMeters) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) return;

  const { data: lastLog, error: lastLogError } = await supabase
    .from("attendance_logs")
    .select("action, occurred_at, site_id, geofence_site_id, sites(name)")
    .eq("employee_id", user.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AttendanceLastLog>();

  if (lastLogError || !lastLog || lastLog.action !== "check_in") return;

  const checkInDate = new Date(lastLog.occurred_at);
  if (
    !Number.isFinite(checkInDate.getTime()) ||
    !isSameLocalDay(checkInDate, new Date())
  ) {
    return;
  }

  const geofenceSiteId = lastLog.geofence_site_id ?? lastLog.site_id;
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude, requires_geofence")
    .eq("id", geofenceSiteId)
    .maybeSingle<SiteRow>();

  if (
    siteError ||
    !site ||
    site.requires_geofence === false ||
    !isValidCoordinate(site.latitude, site.longitude)
  ) {
    return;
  }

  const distanceMeters = calculateDistance(
    validated.latitude,
    validated.longitude,
    Number(site.latitude),
    Number(site.longitude),
  );

  if (distanceMeters + accuracy < SHIFT_DEPARTURE_TRACKING.thresholdMeters) {
    return;
  }

  await supabase.rpc("register_shift_departure_event_autoclose", {
    p_site_id: lastLog.site_id,
    p_distance_meters: Math.round(distanceMeters),
    p_accuracy_meters: Math.round(accuracy),
    p_source: "mobile",
    p_notes: `Background location: ${unwrapRelation(lastLog.sites)?.name ?? site.name ?? "sede"}`,
    p_occurred_at: new Date(
      Math.min(validated.timestamp ?? Date.now(), Date.now()),
    ).toISOString(),
    p_auto_checkout_threshold_meters: SHIFT_DEPARTURE_TRACKING.thresholdMeters,
  });
}

TaskManager.defineTask(
  ATTENDANCE_BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn("[ATTENDANCE][BG_LOCATION] Task error:", error);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | null)
      ?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    try {
      await handleBackgroundLocation(latest);
    } catch (err) {
      console.warn("[ATTENDANCE][BG_LOCATION] Handler error:", err);
    }
  },
);

export async function ensureAttendanceBackgroundLocationPermission() {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== "granted" && background.canAskAgain) {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  return background.status === "granted";
}

export async function startAttendanceBackgroundLocation() {
  const permissionGranted =
    await ensureAttendanceBackgroundLocationPermission();
  if (!permissionGranted) return false;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return false;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    ATTENDANCE_BACKGROUND_LOCATION_TASK,
  );
  if (alreadyStarted) return true;

  await Location.startLocationUpdatesAsync(
    ATTENDANCE_BACKGROUND_LOCATION_TASK,
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 50,
      deferredUpdatesInterval: 60000,
      deferredUpdatesDistance: 50,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService:
        Platform.OS === "android"
          ? {
              notificationTitle: "ANIMA está validando tu turno",
              notificationBody:
                "La ubicación se usa durante el turno activo para registrar salida de sede.",
              notificationColor: "#E2006A",
            }
          : undefined,
    },
  );

  return true;
}

export async function stopAttendanceBackgroundLocation() {
  const started = await Location.hasStartedLocationUpdatesAsync(
    ATTENDANCE_BACKGROUND_LOCATION_TASK,
  );
  if (!started) return;

  await Location.stopLocationUpdatesAsync(ATTENDANCE_BACKGROUND_LOCATION_TASK);
}
