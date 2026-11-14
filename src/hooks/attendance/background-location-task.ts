import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  buildValidatedLocationFromRaw,
  calculateDistance,
} from "@/lib/geolocation";
import { getSupabaseAuthSession, supabase } from "@/lib/supabase";
import {
  SHIFT_DEPARTURE_TRACKING,
  findBlockingGeoWarning,
} from "@/hooks/attendance/shared";

const BG_DEPARTURE_NOTICE_KEY = "anima.attendance.departure-notice";
// La salida local puede estar pendiente de sincronizar. No debe reactivar GPS.
const BG_LOCAL_CHECKOUT_KEY = "anima.attendance.local-checkout";
const BG_OUTSIDE_CONFIRMATION_MS = 45000;

type BackgroundDepartureNotice = {
  shiftKey: string;
  firstOutsideAt: number;
  warned: boolean;
};

async function readDepartureNotice(): Promise<BackgroundDepartureNotice | null> {
  const raw = await SecureStore.getItemAsync(BG_DEPARTURE_NOTICE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as BackgroundDepartureNotice;
    if (
      typeof state.shiftKey !== "string" ||
      !Number.isFinite(state.firstOutsideAt) ||
      typeof state.warned !== "boolean"
    ) return null;
    return state;
  } catch {
    return null;
  }
}

async function saveDepartureNotice(state: BackgroundDepartureNotice) {
  await SecureStore.setItemAsync(BG_DEPARTURE_NOTICE_KEY, JSON.stringify(state));
}

export const ATTENDANCE_BACKGROUND_LOCATION_TASK =
  "anima-attendance-background-location";

// Cancela inicios nativos que aun esten pendientes cuando se cierra el turno.
let trackingGeneration = 0;

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
  // El check-out local prevalece aunque su evento de red siga en cola.
  if (await SecureStore.getItemAsync(BG_LOCAL_CHECKOUT_KEY)) {
    await stopAttendanceBackgroundLocation();
    return;
  }
  // No procesar coordenadas antes de confirmar un turno laboral abierto.
  const session = await getSupabaseAuthSession("attendance background location");
  const user = session?.user;
  if (!user?.id) {
    await stopAttendanceBackgroundLocation();
    return;
  }

  const { data: lastLog, error: lastLogError } = await supabase
    .from("attendance_logs")
    .select("action, occurred_at, site_id, geofence_site_id, sites(name)")
    .eq("employee_id", user.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AttendanceLastLog>();

  if (lastLogError || !lastLog || lastLog.action !== "check_in" ||
    !Number.isFinite(new Date(lastLog.occurred_at).getTime())) {
    // Error de consulta: fallar cerrado, nunca seguir localizando un turno incierto.
    await stopAttendanceBackgroundLocation();
    await SecureStore.deleteItemAsync(BG_DEPARTURE_NOTICE_KEY);
    return;
  }

  // Un descanso abierto impide avisos de salida y reinicia la confirmacion.
  // Un error de lectura tambien falla cerrado: no reutilizar muestras antiguas.
  const { data: openBreak, error: breakError } = await supabase
    .from("attendance_breaks")
    .select("id")
    .eq("employee_id", user.id)
    .is("ended_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (breakError || openBreak) {
    await SecureStore.deleteItemAsync(BG_DEPARTURE_NOTICE_KEY);
    return;
  }

  const preciseAllowed = await ensureAttendanceBackgroundLocationPermission();
  if (!preciseAllowed) {
    await stopAttendanceBackgroundLocation();
    return;
  }
  const validated = buildValidatedLocationFromRaw(rawLocation);
  if (
    !validated ||
    !Number.isFinite(validated.latitude) ||
    !Number.isFinite(validated.longitude) ||
    !validated.isValid ||
    Boolean(findBlockingGeoWarning(validated))
  ) return;

  const accuracy = validated.accuracy ?? 999;
  if (accuracy > SHIFT_DEPARTURE_TRACKING.maxAccuracyMeters) return;

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

  const shiftKey = `${lastLog.site_id}|${lastLog.occurred_at}`;
  const previous = await readDepartureNotice();
  const now = Date.now();

  // La salida física solo produce una alerta, nunca un check-out.
  // Descontamos el margen de error para no alertar por una lectura ambigua.
  if (distanceMeters - accuracy < SHIFT_DEPARTURE_TRACKING.thresholdMeters) {
    if (previous?.shiftKey === shiftKey) {
      await SecureStore.deleteItemAsync(BG_DEPARTURE_NOTICE_KEY);
    }
    return;
  }

  if (!previous || previous.shiftKey !== shiftKey) {
    await saveDepartureNotice({ shiftKey, firstOutsideAt: now, warned: false });
    return;
  }

  if (previous.warned || now - previous.firstOutsideAt < BG_OUTSIDE_CONFIRMATION_MS) {
    return;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Posible salida de sede",
      body: `Parece que te alejaste de ${site.name ?? "tu sede"}. Tu turno continúa abierto. Si terminaste, registra tu salida manualmente.`,
      data: { type: "shift" },
      sound: true,
    },
    trigger: null,
  });
  await saveDepartureNotice({ ...previous, warned: true });
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

export async function ensureAttendanceBackgroundLocationPermission(
  { request = false }: { request?: boolean } = {},
) {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (request && (foreground.status !== "granted" ||
      (Platform.OS === "android" && foreground.android?.accuracy !== "fine"))) {
    if (foreground.canAskAgain) {
      foreground = await Location.requestForegroundPermissionsAsync();
    }
  }
  if (foreground.status !== "granted") return false;
  // Android 12+ permits approximate location despite a granted permission.
  if (Platform.OS === "android" && foreground.android?.accuracy !== "fine") return false;

  let background = await Location.getBackgroundPermissionsAsync();
  if (request && background.status !== "granted" && background.canAskAgain) {
    // On Android 11+ this can open system settings; never fake a grant.
    background = await Location.requestBackgroundPermissionsAsync();
  }
  return background.status === "granted" &&
    await Location.hasServicesEnabledAsync() &&
    await Location.isBackgroundLocationAvailableAsync();
}

export async function startAttendanceBackgroundLocation(
  { confirmedNewCheckIn = false }: { confirmedNewCheckIn?: boolean } = {},
) {
  const generation = trackingGeneration;
  // El task nativo anterior no demuestra por sí mismo un turno abierto.
  const started = await Location.hasStartedLocationUpdatesAsync(
    ATTENDANCE_BACKGROUND_LOCATION_TASK,
  );
  if (!confirmedNewCheckIn && await SecureStore.getItemAsync(BG_LOCAL_CHECKOUT_KEY)) {
    if (started) await stopAttendanceBackgroundLocation();
    return false;
  }

  // Comprobar el turno real ANTES de reactivar un permiso opcional.
  const session = await getSupabaseAuthSession("attendance background activation");
  if (!session?.user?.id) {
    if (started) await stopAttendanceBackgroundLocation();
    return false;
  }
  const { data: latestLog, error: latestError } = await supabase
    .from("attendance_logs")
    .select("action")
    .eq("employee_id", session.user.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ action: "check_in" | "check_out" }>();
  if (latestError || latestLog?.action !== "check_in") {
    if (started) await stopAttendanceBackgroundLocation();
    return false;
  }
  if (generation !== trackingGeneration) return false;
  if (confirmedNewCheckIn) {
    // La entrada confirmada desbloquea el marcador anterior aun si se rehúsa
    // ubicación background; su permiso se puede conceder más adelante.
    await SecureStore.deleteItemAsync(BG_LOCAL_CHECKOUT_KEY);
  }

  const permissionGranted = await ensureAttendanceBackgroundLocationPermission();
  if (!permissionGranted) {
    if (started) await stopAttendanceBackgroundLocation();
    return false;
  }
  if (started) return true;

  await Location.startLocationUpdatesAsync(
    ATTENDANCE_BACKGROUND_LOCATION_TASK,
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000,
      distanceInterval: 20,
      deferredUpdatesInterval: 60000,
      deferredUpdatesDistance: 50,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService:
        Platform.OS === "android"
          ? {
              notificationTitle: "ANIMA: turno activo",
              notificationBody:
                "Ubicación precisa durante tu turno. Registra tu salida para detener el seguimiento.",
              notificationColor: "#E2006A",
            }
          : undefined,
    },
  );
  if (generation !== trackingGeneration) {
    await stopAttendanceBackgroundLocation();
    return false;
  }
  return await Location.hasStartedLocationUpdatesAsync(ATTENDANCE_BACKGROUND_LOCATION_TASK);
}

export async function stopAttendanceBackgroundLocation(
  { localCheckout = false }: { localCheckout?: boolean } = {},
) {
  trackingGeneration += 1;
  if (localCheckout) {
    await SecureStore.setItemAsync(BG_LOCAL_CHECKOUT_KEY, "1");
  }
  const started = await Location.hasStartedLocationUpdatesAsync(
    ATTENDANCE_BACKGROUND_LOCATION_TASK,
  );
  if (!started) return;

  await Location.stopLocationUpdatesAsync(ATTENDANCE_BACKGROUND_LOCATION_TASK);
}
