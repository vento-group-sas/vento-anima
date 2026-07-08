import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  buildValidatedLocationFromRaw,
  calculateDistance,
} from "@/lib/geolocation";
import { getSupabaseAuthSession, supabase } from "@/lib/supabase";
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
  latitude: number | string | null;
  longitude: number | string | null;
  checkin_radius_meters: number | string | null;
};

type SiteAttendancePolicyRow = {
  checkin_radius_meters: number | string | null;
  requires_geofence: boolean | null;
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

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isValidCoordinate(latitude: unknown, longitude: unknown) {
  return toFiniteNumber(latitude) !== null && toFiniteNumber(longitude) !== null;
}

async function resolveGeofenceRequirement(siteId: string, site: SiteRow) {
  const hasCoordinates = isValidCoordinate(site.latitude, site.longitude);
  let requiresGeofence = hasCoordinates;
  let radiusMeters = toFiniteNumber(site.checkin_radius_meters) ?? 0;

  const { data, error } = await supabase
    .from("site_attendance_policy")
    .select("checkin_radius_meters, requires_geofence")
    .eq("site_id", siteId)
    .maybeSingle<SiteAttendancePolicyRow>();

  if (error) {
    console.warn("[ATTENDANCE][BG_LOCATION] Policy lookup error:", error);
    return { requiresGeofence, radiusMeters };
  }

  const policyRadius = toFiniteNumber(data?.checkin_radius_meters);
  if (policyRadius !== null) {
    radiusMeters = policyRadius;
  }

  if (data?.requires_geofence != null) {
    requiresGeofence = Boolean(data.requires_geofence);
  }

  return { requiresGeofence, radiusMeters };
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

  const session = await getSupabaseAuthSession("attendance background location");
  const user = session?.user;
  if (!user?.id) return;

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
    .select("id, name, latitude, longitude, checkin_radius_meters")
    .eq("id", geofenceSiteId)
    .maybeSingle<SiteRow>();

  if (siteError || !site) return;

  const { requiresGeofence } = await resolveGeofenceRequirement(
    geofenceSiteId,
    site,
  );
  if (requiresGeofence === false) return;

  const siteLatitude = toFiniteNumber(site.latitude);
  const siteLongitude = toFiniteNumber(site.longitude);
  if (siteLatitude === null || siteLongitude === null) return;

  const distanceMeters = calculateDistance(
    validated.latitude,
    validated.longitude,
    siteLatitude,
    siteLongitude,
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
