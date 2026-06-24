import type { ValidatedLocation } from "@/lib/geolocation";
import type { GeofenceCheckState, GeofenceMode } from "@/hooks/attendance/shared";
import { buildGeofenceBlockedState } from "@/hooks/attendance/geofence-state";

type EmployeeSiteLike = {
  siteId: string;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
};

type LastAttendanceLog = {
  action: "check_in" | "check_out";
  site_id: string;
} | null;

type UpdateSource = "auto" | "user" | "check_action";

type ShiftGeofenceContext = {
  /**
   * Operational site for the shift. This is the business context stored as
   * attendance_logs.site_id and used by apps such as NEXO.
   */
  operationalSiteId?: string | null;

  /**
   * Physical check-in point. For drivers this can be a hidden site such as the
   * vehicle parking/pickup point.
   */
  checkInSiteId?: string | null;

  /**
   * Physical check-out point. Falls back to the operational site when empty.
   */
  checkOutSiteId?: string | null;
};

type ResolveGeofenceTargetArgs = {
  argsMode?: GeofenceMode;
  argsSiteId?: string | null;
  selectedSiteId?: string | null;
  employeeSites: EmployeeSiteLike[];

  /**
   * Extra geofence-only sites. These are intentionally separate from
   * employeeSites so hidden check-in points do not appear as normal selectable
   * operational sites.
   */
  geofenceSites?: EmployeeSiteLike[];

  /**
   * Optional shift context used to separate operational context from the
   * physical geofence target.
   */
  shiftGeofenceContext?: ShiftGeofenceContext | null;

  lastLog: LastAttendanceLog;
  now: number;
  updateSource: UpdateSource;
  location: ValidatedLocation | null;
  checkInMaxAccuracyMeters: number;
  checkOutMaxAccuracyMeters: number;
  resolveBestEffortSelectionLocation: (
    location: ValidatedLocation | null,
  ) => Promise<ValidatedLocation | null>;
  buildSelectionCandidates: (
    employeeSites: EmployeeSiteLike[],
    baseLocation: ValidatedLocation | null,
  ) => Array<{
    id: string;
    name: string;
    distanceMeters: number | null;
    effectiveRadiusMeters: number;
    requiresGeolocation: boolean;
  }>;
  buildDeviceInfoPayload: (
    location: ValidatedLocation | null,
    extra?: Record<string, unknown>,
  ) => Record<string, unknown> | null;
};

type SelectionCandidate = {
  id: string;
  name: string;
  distanceMeters: number | null;
  effectiveRadiusMeters: number;
  requiresGeolocation: boolean;
};

function asCleanId(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function uniqueSites(sites: EmployeeSiteLike[]) {
  const seen = new Set<string>();
  const resolved: EmployeeSiteLike[] = [];

  for (const site of sites) {
    const siteId = asCleanId(site.siteId);

    if (!siteId || seen.has(siteId)) continue;

    seen.add(siteId);
    resolved.push({
      ...site,
      siteId,
    });
  }

  return resolved;
}

function findSite(sites: EmployeeSiteLike[], siteId: string | null) {
  if (!siteId) return null;
  return sites.find((site) => site.siteId === siteId) ?? null;
}

function getCandidatesInsideRange(candidates: SelectionCandidate[]) {
  return candidates
    .filter((candidate) => {
      if (!candidate.requiresGeolocation) return false;
      if (candidate.distanceMeters == null) return false;
      if (candidate.effectiveRadiusMeters <= 0) return false;
      return candidate.distanceMeters <= candidate.effectiveRadiusMeters;
    })
    .sort((left, right) => {
      const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });
}

function resolveExplicitGeofenceSiteId({
  mode,
  shiftGeofenceContext,
}: {
  mode: GeofenceMode;
  shiftGeofenceContext?: ShiftGeofenceContext | null;
}) {
  if (!shiftGeofenceContext) return null;

  if (mode === "check_out") {
    return asCleanId(shiftGeofenceContext.checkOutSiteId);
  }

  return asCleanId(shiftGeofenceContext.checkInSiteId);
}

function resolveOperationalSiteId({
  mode,
  explicitOperationalSiteId,
  argsSiteId,
  selectedSiteId,
  lastLog,
  fallbackGeofenceSiteId,
}: {
  mode: GeofenceMode;
  explicitOperationalSiteId: string | null;
  argsSiteId: string | null;
  selectedSiteId: string | null;
  lastLog: LastAttendanceLog;
  fallbackGeofenceSiteId: string | null;
}) {
  if (explicitOperationalSiteId) return explicitOperationalSiteId;

  if (mode === "check_out") {
    return asCleanId(lastLog?.site_id) ?? argsSiteId ?? fallbackGeofenceSiteId;
  }

  return argsSiteId ?? selectedSiteId ?? fallbackGeofenceSiteId;
}

export async function resolveGeofenceTarget({
  argsMode,
  argsSiteId,
  selectedSiteId,
  employeeSites,
  geofenceSites = [],
  shiftGeofenceContext,
  lastLog,
  now,
  updateSource,
  location,
  checkInMaxAccuracyMeters,
  checkOutMaxAccuracyMeters,
  resolveBestEffortSelectionLocation,
  buildSelectionCandidates,
  buildDeviceInfoPayload,
}: ResolveGeofenceTargetArgs):
  Promise<
    | {
        kind: "resolved";
        mode: GeofenceMode;

        /**
         * Operational site. This should be persisted as attendance_logs.site_id.
         */
        siteId: string;

        /**
         * Physical geofence target. This should be used for distance validation
         * and persisted as attendance_logs.geofence_site_id.
         */
        geofenceSiteId: string;

        policy: { maxAccuracyMeters: number };
        location: ValidatedLocation | null;
      }
    | {
        kind: "blocked";
        state: GeofenceCheckState;
      }
  > {
  const mode =
    argsMode ?? (lastLog?.action === "check_in" ? "check_out" : "check_in");
  const maxAccuracyMeters =
    mode === "check_out"
      ? checkOutMaxAccuracyMeters
      : checkInMaxAccuracyMeters;
  const policy = { maxAccuracyMeters };

  const normalizedEmployeeSites = uniqueSites(employeeSites);
  const normalizedGeofenceSites = uniqueSites([
    ...normalizedEmployeeSites,
    ...geofenceSites,
  ]);

  const explicitGeofenceSiteId = resolveExplicitGeofenceSiteId({
    mode,
    shiftGeofenceContext,
  });
  const explicitOperationalSiteId = asCleanId(
    shiftGeofenceContext?.operationalSiteId,
  );
  const cleanArgsSiteId = asCleanId(argsSiteId);
  const cleanSelectedSiteId = asCleanId(selectedSiteId);

  if (explicitGeofenceSiteId) {
    const explicitGeofenceSite = findSite(
      normalizedGeofenceSites,
      explicitGeofenceSiteId,
    );

    if (!explicitGeofenceSite) {
      return {
        kind: "blocked",
        state: buildGeofenceBlockedState({
          mode,
          lastUpdateSource: updateSource,
          message: "No se encontró el punto de marcación asignado al turno.",
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofenceSiteId: explicitGeofenceSiteId,
            operationalSiteId: explicitOperationalSiteId,
            reason: "missing_shift_geofence_site",
          }),
        }),
      };
    }

    const operationalSiteId = resolveOperationalSiteId({
      mode,
      explicitOperationalSiteId,
      argsSiteId: cleanArgsSiteId,
      selectedSiteId: cleanSelectedSiteId,
      lastLog,
      fallbackGeofenceSiteId: explicitGeofenceSiteId,
    });

    if (!operationalSiteId) {
      return {
        kind: "blocked",
        state: buildGeofenceBlockedState({
          mode,
          lastUpdateSource: updateSource,
          message: "No se encontró la sede operativa del turno.",
          updatedAt: now,
          location,
          deviceInfo: buildDeviceInfoPayload(location, {
            geofenceSiteId: explicitGeofenceSiteId,
            reason: "missing_shift_operational_site",
          }),
        }),
      };
    }

    return {
      kind: "resolved",
      mode,
      siteId: operationalSiteId,
      geofenceSiteId: explicitGeofenceSite.siteId,
      policy,
      location,
    };
  }

  const assignedGeoSites = normalizedEmployeeSites.filter(
    (item) => item.latitude != null && item.longitude != null,
  );
  const assignedNonGeoSites = normalizedEmployeeSites.filter(
    (item) => item.latitude == null || item.longitude == null,
  );

  const selectedSiteIsValid =
    cleanSelectedSiteId != null &&
    normalizedEmployeeSites.some((item) => item.siteId === cleanSelectedSiteId);
  const effectiveSelectedSiteId = selectedSiteIsValid ? cleanSelectedSiteId : null;

  let siteId: string | null = null;

  if (mode === "check_out") {
    siteId = cleanArgsSiteId ?? asCleanId(lastLog?.site_id);
  } else {
    if (cleanArgsSiteId) {
      siteId = cleanArgsSiteId;
    } else if (normalizedEmployeeSites.length > 1) {
      if (effectiveSelectedSiteId) {
        siteId = effectiveSelectedSiteId;

        const selectionLocation =
          await resolveBestEffortSelectionLocation(location);
        const candidates = buildSelectionCandidates(
          normalizedEmployeeSites,
          selectionLocation ?? null,
        );
        const selectedCandidate = candidates.find(
          (candidate) => candidate.id === effectiveSelectedSiteId,
        );
        const selectedInsideRange =
          selectedCandidate?.requiresGeolocation === true &&
          selectedCandidate.distanceMeters != null &&
          selectedCandidate.effectiveRadiusMeters > 0 &&
          selectedCandidate.distanceMeters <= selectedCandidate.effectiveRadiusMeters;
        const insideRange = getCandidatesInsideRange(candidates);

        if (
          selectionLocation &&
          !selectedInsideRange &&
          insideRange.length === 1
        ) {
          siteId = insideRange[0].id;
        }
      } else {
        const selectionLocation =
          await resolveBestEffortSelectionLocation(location);
        const candidates = buildSelectionCandidates(
          normalizedEmployeeSites,
          selectionLocation ?? null,
        );
        const insideRange = getCandidatesInsideRange(candidates);

        if (insideRange.length === 1) {
          siteId = insideRange[0].id;
        } else if (assignedNonGeoSites.length === 1 && assignedGeoSites.length === 0) {
          siteId = assignedNonGeoSites[0].siteId;
        } else {
          return {
            kind: "blocked",
            state: buildGeofenceBlockedState({
              mode,
              lastUpdateSource: updateSource,
              message:
                insideRange.length > 1
                  ? "Estás cerca de varias sedes. Elige una para continuar."
                  : "Selecciona una sede para continuar",
              updatedAt: now,
              location: selectionLocation ?? null,
              deviceInfo: buildDeviceInfoPayload(selectionLocation ?? null),
              requiresSelection: true,
              candidateSites: candidates,
              accuracyMeters: selectionLocation?.accuracy ?? null,
            }),
          };
        }
      }
    } else if (normalizedEmployeeSites.length === 1) {
      siteId = normalizedEmployeeSites[0].siteId;
    } else if (assignedGeoSites.length === 1) {
      siteId = assignedGeoSites[0].siteId;
    } else if (assignedNonGeoSites.length === 1) {
      siteId = assignedNonGeoSites[0].siteId;
    }
  }

  if (!siteId) {
    return {
      kind: "blocked",
      state: buildGeofenceBlockedState({
        mode,
        lastUpdateSource: updateSource,
        message: "No tienes sede asignada",
        updatedAt: now,
      }),
    };
  }

  return {
    kind: "resolved",
    mode,
    siteId,
    geofenceSiteId: siteId,
    policy,
    location,
  };
}
