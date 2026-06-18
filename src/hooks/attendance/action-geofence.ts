import type { GeofenceCheckState, GeofenceMode } from "@/hooks/attendance/shared";

type RefreshGeofence = (args: {
  force?: boolean;
  mode?: GeofenceMode;
  siteId?: string | null;
  source?: "check_action";
}) => Promise<GeofenceCheckState>;

type ReuseRecentReady = (
  mode: GeofenceMode,
  siteId?: string | null,
) => GeofenceCheckState | null;

type EnsureActionGeofenceReadyArgs = {
  mode: GeofenceMode;
  refreshGeofence: RefreshGeofence;
  canReuseRecentReadyGeofence: ReuseRecentReady;
  siteId?: string | null;
  waitForReady?: boolean;
};

export async function ensureActionGeofenceReady({
  mode,
  refreshGeofence,
  canReuseRecentReadyGeofence,
  siteId,
  waitForReady = false,
}: EnsureActionGeofenceReadyArgs): Promise<GeofenceCheckState> {
  let geo = await refreshGeofence({
    force: false,
    mode,
    siteId,
    source: "check_action",
  });

  if (!geo.canProceed) {
    geo = await refreshGeofence({
      force: true,
      mode,
      siteId,
      source: "check_action",
    });
  }

  if (waitForReady) {
    const maxWait = 8000;
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = 4;

    while (
      (geo.status === "checking" || !geo.canProceed) &&
      Date.now() - startTime < maxWait &&
      attempts < maxAttempts &&
      geo.status !== "blocked" &&
      geo.status !== "error"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      geo = await refreshGeofence({
        force: true,
        mode,
        siteId,
        source: "check_action",
      });
      attempts++;
      if (geo.canProceed && geo.status === "ready") break;
    }
  }

  if (!geo.canProceed) {
    const cachedReady = canReuseRecentReadyGeofence(mode, siteId);
    if (cachedReady) {
      geo = cachedReady;
    }
  }

  return geo;
}
