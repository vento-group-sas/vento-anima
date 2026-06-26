import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "expo-router";
import { useAttendanceContext } from "@/contexts/attendance-context";
import { AttendanceDiagnosticsCard } from "@/components/home/AttendanceDiagnosticsCard";
import { AttendanceActionErrorCard } from "@/components/home/AttendanceActionErrorCard";
import { AttendanceActionCard } from "@/components/home/AttendanceActionCard";
import { GeofenceStatusCard } from "@/components/home/GeofenceStatusCard";
import { HomeHeroCard } from "@/components/home/HomeHeroCard";
import { NotificationsPromptCard } from "@/components/home/NotificationsPromptCard";
import { OfflineStatusCard } from "@/components/home/OfflineStatusCard";
import { OperativoReportScreen } from "@/components/home/OperativoReportScreen";
import { PendingSyncCard } from "@/components/home/PendingSyncCard";
import { SitePickerModal } from "@/components/home/SitePickerModal";
import { TodaySummaryCard } from "@/components/home/TodaySummaryCard";
import { TodayTeamCard } from "@/components/home/TodayTeamCard";
import { useHomeAttendanceActions } from "@/components/home/use-home-attendance-actions";
import { UserMenuModal } from "@/components/home/UserMenuModal";
import { useHomeAttendanceView } from "@/components/home/use-home-attendance-view";
import { useHomeTodayTeam } from "@/components/home/use-home-today-team";
import { useHomeNotifications } from "@/components/home/use-home-notifications";
import { useHomeNavigation } from "@/components/home/use-home-navigation";
import { useHomeScreenLifecycle } from "@/components/home/use-home-screen-lifecycle";
import { ANIMA_RUNTIME } from "@/brand/anima/config/runtime";
import { PALETTE, RGBA } from "@/components/home/theme";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { calculateDistance } from "@/lib/geolocation";
function formatClock(value: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

const EXPO_PROJECT_ID = ANIMA_RUNTIME.expoProjectId;

function formatRetryClock(value: number | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemainingShort(ms: number) {
  const safe = Math.max(0, ms);
  const totalMinutes = Math.ceil(safe / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes} min`;
}

function formatLatency(value: number | null) {
  if (value == null) return "--";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const {
    user,
    employee,
    signOut,
    refreshEmployee,
    hasPendingSiteChanges,
    consumePendingSiteChanges,
    employeeSites,
    selectedSiteId,
    isLoading: authIsLoading,
  } = useAuth();
  const {
    attendanceState,
    geofenceState,
    refreshGeofence,
    isLoading,
    isOffline,
    pendingAttendanceCount,
    pendingAttendanceSyncingCount,
    pendingAttendanceFailedCount,
    pendingAttendanceConflictCount,
    pendingAttendanceNextRetryAt,
    pendingAttendanceLastError,
    pendingAttendanceOldestCreatedAt,
    attendanceUxState,
    attendanceUxMessage,
    attendanceDiagnostics,
    syncPendingAttendanceQueue,
    loadTodayAttendance,
    checkIn,
    checkOut,
    selectSiteForCheckIn,
    startRealtimeGeofence,
    stopRealtimeGeofence,
  } = useAttendanceContext();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [deferredHomeReady, setDeferredHomeReady] = useState(false);
  const [opsSectionY, setOpsSectionY] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const {
    isLoading: isLoadingTodayTeam,
    coworkerCount,
    coworkerNames,
  } = useHomeTodayTeam({
    userId: user?.id,
    siteId: employee?.siteId ?? attendanceState.currentSiteId,
    enabled: deferredHomeReady,
  });

  const showAttendanceDiagnostics =
    process.env.EXPO_PUBLIC_SHOW_ATTENDANCE_DIAGNOSTICS === "1";
  const {
    isRefreshing,
    actionError,
    setActionError,
    isCheckActionLocked,
    recentQueuedFeedback,
    handleRefresh,
    handleCheck,
  } = useHomeAttendanceActions({
    userId: user?.id,
    isLoading,
    isGeoChecking: geofenceState.status === "checking",
    isCheckedIn: attendanceState.status === "checked_in",
    requiresSelection: geofenceState.requiresSelection,
    loadTodayAttendance,
    refreshGeofence,
    checkIn,
    checkOut,
    onRequireSiteSelection: () => setIsSitePickerOpen(true),
  });
  const {
    handleSignOut,
    goToShifts,
    handleSelectSite,
  } = useHomeNavigation({
    router,
    signOut,
    setIsUserMenuOpen,
    setIsSitePickerOpen,
    setActionError,
    selectSiteForCheckIn,
  });

  const {
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
  } = useHomeAttendanceView({
    attendanceState,
    geofenceState,
    isLoading,
    isCheckActionLocked,
    pendingAttendanceCount,
    pendingAttendanceSyncingCount,
    attendanceUxState: recentQueuedFeedback ? "queued" : attendanceUxState,
    attendanceUxMessage,
  });

  const handleOpsPillPress = useCallback(() => {
    const targetY = Math.max(0, opsSectionY - 12);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [opsSectionY]);

  const { initialLoadDone } = useHomeScreenLifecycle({
    userId: user?.id,
    authIsLoading,
    employee,
    employeeSites,
    hasPendingSiteChanges,
    attendanceStatus: attendanceState.status,
    lastCheckIn: attendanceState.lastCheckIn,
    isCheckedIn,
    geofenceStatus: geofenceState.status,
    geofenceUpdatedAt: geofenceState.updatedAt,
    loadTodayAttendance,
    refreshGeofence,
    refreshEmployee,
    consumePendingSiteChanges,
    startRealtimeGeofence,
    stopRealtimeGeofence,
    setActionError,
  });

  useEffect(() => {
    if (geofenceState.requiresSelection) {
      setIsSitePickerOpen(true);
    }
  }, [geofenceState.requiresSelection]);

  const {
    notificationPermissionStatus,
    notificationPromptLoading,
    hasActivePushToken,
    requestNotificationPermissionOrOpenSettings,
  } = useHomeNotifications({
    userId: user?.id,
    authIsLoading,
    initialLoadDone,
    dependencyKey: `${employee?.id ?? ""}:${employeeSites.length}`,
    expoProjectId: EXPO_PROJECT_ID,
    enabled: deferredHomeReady,
  });

  useEffect(() => {
    if (!initialLoadDone || !user?.id) {
      setDeferredHomeReady(false);
      return;
    }

    const timer = setTimeout(() => {
      setDeferredHomeReady(true);
    }, 900);

    return () => clearTimeout(timer);
  }, [initialLoadDone, user?.id]);

  const displayName =
    employee?.alias ||
    employee?.fullName?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const canSeeAttendanceHours =
    employee?.role === "propietario" ||
    employee?.role === "gerente_general" ||
    employee?.role === "gerente";
  const canSeeHomeReports =
    employee?.role === "propietario" ||
    employee?.role === "gerente_general" ||
    employee?.role === "gerente";
  const fallbackSiteName = attendanceState.currentSiteName || employee?.siteName || null;
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "U";

  const todayLabel = useMemo(() => {
    const now = new Date();
    const day = now.toLocaleDateString("es-CO", { weekday: "long" });
    const date = now.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
    });
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} - ${date}`;
  }, []);

  const selectedSite = useMemo(() => {
    const targetId =
      selectedSiteId ?? employee?.siteId ?? employeeSites[0]?.siteId ?? null;
    if (!targetId) return null;
    return employeeSites.find((site) => site.siteId === targetId) ?? null;
  }, [selectedSiteId, employee?.siteId, employeeSites]);
  const activeSiteName =
    geofenceState.siteName ||
    selectedSite?.siteName ||
    fallbackSiteName ||
    "Sin sede asignada";
  const geofenceInfoMessage = geofenceState.isLatchedReady
    ? geofenceState.message ||
    "Validación temporal activa. Puedes registrar mientras se restablece la señal."
    : isOffline
      ? "Sin conexión o red inestable: el registro puede fallar."
      : geofenceState.status === "ready"
        ? "Ubicación verificada. Ya tienes permiso para registrar."
        : geofenceState.message || "Verifica tu ubicación para poder registrar.";
  const canChooseSite = employeeSites.length > 1;
  const shouldShowPendingSyncCard =
    pendingAttendanceCount > 0 ||
    pendingAttendanceFailedCount > 0 ||
    pendingAttendanceConflictCount > 0;
  const shouldShowGeofenceCard =
    isOffline ||
    canChooseSite ||
    geofenceState.status !== "ready" ||
    Boolean(geofenceState.message && geofenceState.status !== "ready");
  const shouldShowHeroGeofencePill =
    geofenceState.status !== "ready" || canChooseSite || Boolean(geofenceState.requiresSelection);
  const shouldShowHeroConnectivityPill = isOffline;
  const shouldShowHeroPendingPill = hasPendingAny || isSyncingAny;
  const geofenceStatusTitle = isOffline
    ? "Sin conexión"
    : geofenceState.requiresSelection
      ? "Elige una sede"
      : geofenceState.status === "ready"
        ? "Listo para registrar"
        : geofenceState.status === "blocked"
          ? "Revisa tu ubicación"
          : geofenceState.status === "checking"
            ? "Verificando ubicación"
            : "Ubicación pendiente";
  const geofenceSupportMessage = isOffline
    ? "Tu registro puede tardar hasta que vuelva la conexión."
    : geofenceState.requiresSelection
      ? "Selecciona desde qué sede vas a registrar."
      : geofenceState.status === "ready"
        ? geofenceState.distanceMeters != null
          ? `Estás a ${geofenceState.distanceMeters} m de la sede.`
          : "Tu ubicación ya fue validada."
        : geofenceState.status === "blocked"
          ? geofenceState.distanceMeters != null
            ? `Aún estás a ${geofenceState.distanceMeters} m de la sede.`
            : "Acércate a tu sede para registrar."
          : geofenceState.status === "checking"
            ? "Espera un momento mientras confirmamos tu ubicación."
            : geofenceState.message || "Necesitamos tu ubicación para validar el registro.";

  const candidateSites = useMemo(() => {
    const baseLocation = geofenceState.location;

    const fallbackSites = employeeSites.map((site) => {
      const hasCoordinates = site.latitude != null && site.longitude != null;
      const distanceMeters =
        baseLocation && hasCoordinates
          ? Math.round(
            calculateDistance(
              baseLocation.latitude,
              baseLocation.longitude,
              site.latitude as number,
              site.longitude as number
            )
          )
          : null;

      return {
        id: site.siteId,
        name: site.siteName,
        distanceMeters,
        effectiveRadiusMeters: site.radiusMeters ?? 0,
        requiresGeolocation: hasCoordinates,
      };
    });

    if (!geofenceState.candidateSites || geofenceState.candidateSites.length === 0) {
      return fallbackSites;
    }

    if (!baseLocation) return geofenceState.candidateSites;

    return geofenceState.candidateSites.map((candidate) => {
      if (candidate.distanceMeters != null || !candidate.requiresGeolocation) {
        return candidate;
      }

      const site = employeeSites.find((item) => item.siteId === candidate.id);
      if (!site || site.latitude == null || site.longitude == null) {
        return candidate;
      }

      return {
        ...candidate,
        distanceMeters: Math.round(
          calculateDistance(
            baseLocation.latitude,
            baseLocation.longitude,
            site.latitude,
            site.longitude
          )
        ),
      };
    });
  }, [geofenceState.candidateSites, geofenceState.location, employeeSites]);
  const topPadding = Math.max(20, insets.top + 12);
  const modalWidth = Math.min(windowWidth - 40, 420);
  const UI = {
    card: {
      backgroundColor: "white",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: PALETTE.border,
      shadowColor: PALETTE.text,
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    cardTint: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: 12,
      backgroundColor: RGBA.cardTint,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
    },
    surface2: {
      backgroundColor: PALETTE.porcelain2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: PALETTE.border,
    },
    pill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: PALETTE.porcelain2,
      borderColor: PALETTE.border,
    },
    btnGhostPink: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: RGBA.borderPink,
      backgroundColor: "rgba(242, 238, 242, 0.70)",
    },
    ctaBase: {
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      overflow: "hidden" as const,
      borderWidth: 1,
    },
    ctaShadow: {
      shadowColor: PALETTE.text,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    ctaHighlight: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: 18,
      backgroundColor: RGBA.ctaHighlight,
    },
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.porcelain }}>

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -280,
          right: -180,
          width: 560,
          height: 560,
          borderRadius: 280,
          backgroundColor: RGBA.washPink,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -260,
          left: -190,
          width: 560,
          height: 560,
          borderRadius: 280,
          backgroundColor: RGBA.washRoseGlow,
        }}
      />
      <UserMenuModal
        visible={isUserMenuOpen}
        topPadding={topPadding}
        onClose={() => setIsUserMenuOpen(false)}
        onSettings={() => {
          setIsUserMenuOpen(false);
          router.push("/account-settings");
        }}
        onSignOut={handleSignOut}
      />

      <SitePickerModal
        visible={isSitePickerOpen}
        modalWidth={modalWidth}
        candidateSites={candidateSites}
        onClose={() => setIsSitePickerOpen(false)}
        onSelectSite={handleSelectSite}
      />

      <View
        style={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: topPadding,
        }}
      >
        <HomeHeroCard
          cardStyle={UI.card}
          pillStyle={UI.pill}
          todayLabel={todayLabel}
          displayName={displayName}
          avatarUrl={employee?.avatarUrl}
          avatarInitial={avatarInitial}
          statusUI={statusUI}
          geofenceUI={geofenceUI}
          geofencePill={geofencePill}
          showGeofencePill={shouldShowHeroGeofencePill}
          showConnectivityPill={shouldShowHeroConnectivityPill}
          hasPendingAny={hasPendingAny}
          isSyncingAny={isSyncingAny}
          pendingCount={pendingAttendanceCount}
          showPendingPill={shouldShowHeroPendingPill}
          showHeaderOpsPill={showHeaderOpsPill}
          headerOpsPill={headerOpsPill}
          onOpenUserMenu={() => setIsUserMenuOpen(true)}
          onPressOpsPill={handleOpsPillPress}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingVertical: 18,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View
          onLayout={(event) => {
            setOpsSectionY(event.nativeEvent.layout.y);
          }}
        />

        {user && (notificationPermissionStatus !== "granted" || hasActivePushToken === false) ? (
          <NotificationsPromptCard
            isLoading={notificationPromptLoading}
            mode={notificationPermissionStatus === "granted" ? "token" : "permission"}
            onPress={requestNotificationPermissionOrOpenSettings}
          />
        ) : null}

        {isOffline ? <OfflineStatusCard onRetry={handleRefresh} /> : null}

        {shouldShowPendingSyncCard ? (
          <PendingSyncCard
            pendingAttendanceCount={pendingAttendanceCount}
            pendingAttendanceFailedCount={pendingAttendanceFailedCount}
            pendingAttendanceConflictCount={pendingAttendanceConflictCount}
            pendingAttendanceOldestCreatedAt={pendingAttendanceOldestCreatedAt}
            pendingAttendanceNextRetryAt={pendingAttendanceNextRetryAt}
            pendingAttendanceLastError={pendingAttendanceLastError}
            formatClock={formatClock}
            formatRetryClock={formatRetryClock}
            onSyncNow={() => {
              void syncPendingAttendanceQueue({ force: true });
            }}
          />
        ) : null}

        {actionError ? <AttendanceActionErrorCard message={actionError} /> : null}

        <AttendanceDiagnosticsCard
          show={showAttendanceDiagnostics}
          diagnostics={attendanceDiagnostics}
          formatLatency={formatLatency}
        />


        <AttendanceActionCard
          cardStyle={UI.card}
          cardTintStyle={UI.cardTint}
          canRegister={canRegister}
          isLoading={isLoading}
          isGeoChecking={isGeoChecking}
          isCheckActionLocked={isCheckActionLocked}
          ctaTextColor={ctaTextColor}
          ctaPrimaryLabel={ctaPrimaryLabel}
          ctaSecondaryLabel={ctaSecondaryLabel}
          onCheck={handleCheck}
        />

        <TodaySummaryCard
          cardStyle={UI.card}
          cardTintStyle={UI.cardTint}
          surfaceStyle={UI.surface2}
          showHours={canSeeAttendanceHours}
          hoursLabel={hoursLabel}
          statusHint={statusUI.hint}
          todaySegments={todaySegments}
          lastCheckOutSource={attendanceState.lastCheckOutSource}
          lastCheckOutRaw={attendanceState.lastCheckOut}
          lastCheckIn={lastCheckIn}
          lastCheckOut={lastCheckOut}
          formatClock={formatClock}
        />

        {shouldShowGeofenceCard ? (
          <GeofenceStatusCard
            cardStyle={UI.card}
            cardTintStyle={UI.cardTint}
            pillStyle={UI.pill}
            buttonGhostStyle={UI.btnGhostPink}
            geofencePill={geofencePill}
            geofenceLabel={geofenceUI.label}
            activeSiteName={activeSiteName}
            isCheckedIn={isCheckedIn}
            isLoading={isLoading}
            isGeoChecking={isGeoChecking}
            isCheckActionLocked={isCheckActionLocked}
            canChooseSite={canChooseSite}
            statusTitle={geofenceStatusTitle}
            supportMessage={geofenceSupportMessage}
            onRefresh={() => {
              void refreshGeofence({ force: true, source: "user" });
            }}
            onSelectSite={() => setIsSitePickerOpen(true)}
          />
        ) : null}

        <TodayTeamCard
          isLoading={isLoadingTodayTeam}
          coworkerCount={coworkerCount}
          coworkerNames={coworkerNames}
          onPress={goToShifts}
        />

        {canSeeHomeReports ? <OperativoReportScreen /> : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}
