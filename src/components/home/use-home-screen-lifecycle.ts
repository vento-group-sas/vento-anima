import { useCallback, useEffect, useRef, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";

type EmployeeLike = {
  fullName?: string | null;
} | null | undefined;

type SiteLike = {
  siteId: string;
} | null;

type RefreshGeofenceArgs = {
  force: boolean;
  source: "user";
};

type RefreshGeofenceResult = {
  status: string;
};

type UseHomeScreenLifecycleArgs = {
  userId: string | null | undefined;
  authIsLoading: boolean;
  employee: EmployeeLike;
  employeeSites: SiteLike[];
  hasPendingSiteChanges: boolean;
  attendanceStatus: string;
  lastCheckIn: string | null;
  isCheckedIn: boolean;
  geofenceStatus: string;
  geofenceUpdatedAt?: number | null;
  loadTodayAttendance: () => Promise<unknown> | unknown;
  refreshGeofence: (
    args: RefreshGeofenceArgs,
  ) => Promise<RefreshGeofenceResult> | RefreshGeofenceResult;
  refreshEmployee: () => Promise<unknown> | unknown;
  consumePendingSiteChanges: () => void;
  startRealtimeGeofence: () => Promise<unknown> | unknown;
  stopRealtimeGeofence: () => Promise<unknown> | unknown;
  setActionError: (message: string) => void;
};

export function useHomeScreenLifecycle({
  userId,
  authIsLoading,
  employee,
  employeeSites,
  hasPendingSiteChanges,
  attendanceStatus,
  lastCheckIn,
  isCheckedIn,
  geofenceStatus,
  geofenceUpdatedAt,
  loadTodayAttendance,
  refreshGeofence,
  refreshEmployee,
  consumePendingSiteChanges,
  startRealtimeGeofence,
  stopRealtimeGeofence,
  setActionError,
}: UseHomeScreenLifecycleArgs) {
  const refreshGeofenceRef = useRef(refreshGeofence);
  const refreshEmployeeRef = useRef(refreshEmployee);
  const consumePendingSiteChangesRef = useRef(consumePendingSiteChanges);
  const startRealtimeGeofenceRef = useRef(startRealtimeGeofence);
  const stopRealtimeGeofenceRef = useRef(stopRealtimeGeofence);

  useEffect(() => {
    refreshGeofenceRef.current = refreshGeofence;
  }, [refreshGeofence]);

  useEffect(() => {
    refreshEmployeeRef.current = refreshEmployee;
  }, [refreshEmployee]);

  useEffect(() => {
    consumePendingSiteChangesRef.current = consumePendingSiteChanges;
  }, [consumePendingSiteChanges]);

  useEffect(() => {
    startRealtimeGeofenceRef.current = startRealtimeGeofence;
  }, [startRealtimeGeofence]);

  useEffect(() => {
    stopRealtimeGeofenceRef.current = stopRealtimeGeofence;
  }, [stopRealtimeGeofence]);

  const initialLoadDoneRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const realtimeStartedRef = useRef(false);
  const siteRefreshInFlightRef = useRef(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [stuckTimeout, setStuckTimeout] = useState(false);

  useEffect(() => {
    if (userId !== lastUserIdRef.current) {
      initialLoadDoneRef.current = false;
      setInitialLoadDone(false);
      lastStatusRef.current = null;
      lastUserIdRef.current = userId ?? null;
    }
  }, [userId]);

  useEffect(() => {
    if (authIsLoading) return;
    if (!userId) {
      initialLoadDoneRef.current = false;
      setInitialLoadDone(false);
      return;
    }

    if (employee === undefined) return;
    if (initialLoadDoneRef.current) return;

    initialLoadDoneRef.current = true;
    setInitialLoadDone(true);

    void loadTodayAttendance();

    if (!employee || employeeSites.length === 0) {
      return;
    }

    void refreshGeofence({ force: true, source: "user" });
  }, [
    authIsLoading,
    employee,
    employeeSites,
    loadTodayAttendance,
    refreshGeofence,
    userId,
  ]);

  useEffect(() => {
    if (!userId || !initialLoadDoneRef.current) return;
    if (lastStatusRef.current === attendanceStatus) return;

    lastStatusRef.current = attendanceStatus;

    if (attendanceStatus === "not_checked_in" && !lastCheckIn) return;

    const timer = setTimeout(() => {
      void refreshGeofence({ force: true, source: "user" });
    }, 500);

    return () => clearTimeout(timer);
  }, [attendanceStatus, lastCheckIn, refreshGeofence, userId]);

  useEffect(() => {
    if (!isCheckedIn || !userId) return;

    const interval = setInterval(() => {
      void loadTodayAttendance();
    }, 60000);

    return () => clearInterval(interval);
  }, [isCheckedIn, loadTodayAttendance, userId]);

  useEffect(() => {
    if (geofenceStatus !== "checking") {
      setStuckTimeout(false);
      return;
    }

    if (!geofenceUpdatedAt) return;

    const timeSinceUpdate = Date.now() - geofenceUpdatedAt;
    if (timeSinceUpdate > 15000 && !stuckTimeout) {
      console.warn("[HOME] Geofence stuck in checking state for too long");
      setStuckTimeout(true);
    }
  }, [geofenceStatus, geofenceUpdatedAt, stuckTimeout]);

  useEffect(() => {
    if (!stuckTimeout) return;

    let cancelled = false;

    const recover = async () => {
      try {
        const next = await refreshGeofenceRef.current({
          force: true,
          source: "user",
        });
        if (!cancelled && next.status === "checking") {
          setActionError(
            "La verificación de ubicación está tardando más de lo normal. Puedes actualizar manualmente o reintentar en unos segundos.",
          );
        }
      } finally {
        if (!cancelled) {
          setStuckTimeout(false);
        }
      }
    };

    void recover();

    return () => {
      cancelled = true;
    };
  }, [setActionError, stuckTimeout]);

  useFocusEffect(
    useCallback(() => {
      if (userId && hasPendingSiteChanges && !siteRefreshInFlightRef.current) {
        siteRefreshInFlightRef.current = true;
        void (async () => {
          try {
            await refreshEmployeeRef.current();
            await refreshGeofenceRef.current({ force: true, source: "user" });
          } finally {
            consumePendingSiteChangesRef.current();
            siteRefreshInFlightRef.current = false;
          }
        })();
      }

      if (!userId || realtimeStartedRef.current) return;

      realtimeStartedRef.current = true;
      void startRealtimeGeofenceRef.current();

      return () => {
        realtimeStartedRef.current = false;
        void stopRealtimeGeofenceRef.current();
      };
    }, [hasPendingSiteChanges, userId]),
  );

  return {
    initialLoadDone,
  };
}
