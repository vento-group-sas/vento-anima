import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { DataCleanupFlow } from "@/components/settings/DataCleanupFlow";
import { DeleteAccountFlow } from "@/components/settings/DeleteAccountFlow";
import { ANIMA_COPY } from "@/brand/anima/copy/app-copy";
import { ANIMA_RUNTIME } from "@/brand/anima/config/runtime";
import { syncRegisteredPushToken, type PushTokenSyncResult } from "@/core/notifications/push-token";

type SettingsSection = "permissions" | "privacy" | "account";
type PermissionState = "granted" | "denied" | "undetermined" | "unknown";

const EXPO_PROJECT_ID = ANIMA_RUNTIME.expoProjectId;
const QA_ALLOWED_EMAILS = new Set(["carlosaaibarra@gmail.com"]);

function canAccessAnimaDiagnostics(email: string | null | undefined) {
  return QA_ALLOWED_EMAILS.has(String(email ?? "").trim().toLowerCase());
}

const SECTION_TABS: Array<{ key: SettingsSection; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "permissions", label: "Permisos", icon: "shield-checkmark-outline" },
  { key: "privacy", label: "Privacidad", icon: "lock-closed-outline" },
  { key: "account", label: "Cuenta", icon: "person-circle-outline" },
];

function normalizePermissionStatus(status: string | null | undefined): PermissionState {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  if (status === "undetermined") return "undetermined";
  return "unknown";
}

function permissionMeta(state: PermissionState, canAskAgain: boolean | null) {
  if (state === "granted") {
    return {
      label: "Activo",
      color: "#0F766E",
      backgroundColor: "#ECFEFF",
      borderColor: "#99F6E4",
    };
  }
  if (state === "denied") {
    if (canAskAgain === false) {
      return {
        label: "Bloqueado",
        color: COLORS.accent,
        backgroundColor: "#FDF2F8",
        borderColor: "#FBCFE8",
      };
    }
    return {
      label: "Denegado",
      color: "#B45309",
      backgroundColor: "#FFFBEB",
      borderColor: "#FDE68A",
    };
  }
  if (state === "undetermined") {
    return {
      label: "Pendiente",
      color: "#B45309",
      backgroundColor: "#FFFBEB",
      borderColor: "#FDE68A",
    };
  }
  return {
    label: "Sin datos",
    color: COLORS.neutral,
    backgroundColor: COLORS.porcelainAlt,
    borderColor: COLORS.border,
  };
}

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>("permissions");
  const [notificationStatus, setNotificationStatus] = useState<PermissionState>("unknown");
  const [locationStatus, setLocationStatus] = useState<PermissionState>("unknown");
  const [notificationCanAskAgain, setNotificationCanAskAgain] = useState<boolean | null>(null);
  const [locationCanAskAgain, setLocationCanAskAgain] = useState<boolean | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);

  const {
    loadingStatus,
    submitting,
    pendingRequest,
    refreshStatus,
    requestFullDeletion,
    requestDataCleanup,
    cancelFullDeletion,
  } = useAccountDeletion(session);

  const refreshPermissions = useCallback(async () => {
    setLoadingPermissions(true);
    try {
      const [notificationsPermission, locationPermission] = await Promise.all([
        Notifications.getPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
      ]);
      setNotificationStatus(normalizePermissionStatus(notificationsPermission.status));
      setLocationStatus(normalizePermissionStatus(locationPermission.status));
      setNotificationCanAskAgain(
        typeof notificationsPermission.canAskAgain === "boolean"
          ? notificationsPermission.canAskAgain
          : null,
      );
      setLocationCanAskAgain(
        typeof locationPermission.canAskAgain === "boolean"
          ? locationPermission.canAskAgain
          : null,
      );
    } catch (err) {
      console.warn("[SETTINGS] Error loading permission status:", err);
      setNotificationStatus("unknown");
      setLocationStatus("unknown");
      setNotificationCanAskAgain(null);
      setLocationCanAskAgain(null);
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  const syncPushToken = useCallback(async (): Promise<PushTokenSyncResult> => {
    if (!user?.id) {
      return { ok: false, message: "No hay sesion activa." };
    }

    const result = await syncRegisteredPushToken({
      userId: user.id,
      expoProjectId: EXPO_PROJECT_ID,
    });

    if (!result.ok) {
      console.warn("[SETTINGS] Push token sync failed after retries:", result.message);
    }

    return result;
  }, [user?.id]);

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (err) {
      Alert.alert("Configuración", "No se pudieron abrir los ajustes del sistema.");
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    setRequestingNotifications(true);
    try {
      const current = await Notifications.getPermissionsAsync();
      const currentStatus = normalizePermissionStatus(current.status);
      const currentCanAskAgain =
        typeof current.canAskAgain === "boolean" ? current.canAskAgain : null;

      if (currentStatus === "granted") {
        const syncResult = await syncPushToken();
        if (syncResult.ok) {
          Alert.alert("Notificaciones", "Notificaciones y token activos correctamente.");
        } else {
          Alert.alert(
            "Notificaciones activas sin token",
            `El permiso está activo, pero falló el registro del token.\n\nDetalle: ${syncResult.message}\n\nPulsa 'Volver a validar' con buena conexión.`,
          );
        }
        return;
      }

      if (currentStatus === "denied" && currentCanAskAgain === false) {
        Alert.alert(
          "Notificaciones bloqueadas",
          ANIMA_COPY.settingsNotificationsBlockedBody,
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Abrir ajustes", onPress: () => void openSystemSettings() },
          ],
        );
        return;
      }

      const asked = await Notifications.requestPermissionsAsync();
      const askedStatus = normalizePermissionStatus(asked.status);
      const askedCanAskAgain =
        typeof asked.canAskAgain === "boolean" ? asked.canAskAgain : null;

      if (askedStatus === "granted") {
        const syncResult = await syncPushToken();
        if (syncResult.ok) {
          Alert.alert("Notificaciones activadas", ANIMA_COPY.settingsNotificationsEnabledBody);
        } else {
          Alert.alert(
            "Permiso activo, token pendiente",
            `Se activó el permiso, pero el token aún no quedó registrado.\n\nDetalle: ${syncResult.message}\n\nToca 'Volver a validar' en unos segundos.`,
          );
        }
      } else if (askedStatus === "denied") {
        if (askedCanAskAgain === false) {
          Alert.alert(
            "Notificaciones bloqueadas",
            "Debes habilitarlas desde Ajustes del sistema.",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Abrir ajustes", onPress: () => void openSystemSettings() },
            ],
          );
        } else {
          Alert.alert(
            "Permiso denegado",
            "Puedes volver a intentarlo desde este botón.",
          );
        }
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo solicitar el permiso de notificaciones.");
    } finally {
      await refreshPermissions();
      setRequestingNotifications(false);
    }
  }, [openSystemSettings, refreshPermissions, syncPushToken]);

  const requestLocationPermission = useCallback(async () => {
    setRequestingLocation(true);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      const currentStatus = normalizePermissionStatus(current.status);
      const currentCanAskAgain =
        typeof current.canAskAgain === "boolean" ? current.canAskAgain : null;

      if (currentStatus === "granted") {
        Alert.alert("Ubicación", "La ubicación ya está activa.");
        return;
      }

      if (currentStatus === "denied" && currentCanAskAgain === false) {
        Alert.alert(
          "Ubicación bloqueada",
          "Debes activar la ubicación en Ajustes para poder hacer check-in.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Abrir ajustes", onPress: () => void openSystemSettings() },
          ],
        );
        return;
      }

      const asked = await Location.requestForegroundPermissionsAsync();
      const askedStatus = normalizePermissionStatus(asked.status);
      const askedCanAskAgain =
        typeof asked.canAskAgain === "boolean" ? asked.canAskAgain : null;

      if (askedStatus === "granted") {
        Alert.alert("Ubicación activada", "Ya puedes validar asistencia con GPS.");
      } else if (askedStatus === "denied") {
        if (askedCanAskAgain === false) {
          Alert.alert(
            "Ubicación bloqueada",
            "Debes activarla manualmente en Ajustes del sistema.",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Abrir ajustes", onPress: () => void openSystemSettings() },
            ],
          );
        } else {
          Alert.alert(
            "Permiso denegado",
            "Puedes volver a intentarlo desde este botón.",
          );
        }
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo solicitar el permiso de ubicación.");
    } finally {
      await refreshPermissions();
      setRequestingLocation(false);
    }
  }, [openSystemSettings, refreshPermissions]);

  const canOpenAnimaDiagnostics = canAccessAnimaDiagnostics(user?.email);

  const openAnimaDiagnostics = useCallback(() => {
    router.push("/anima-diagnostics");
  }, [router]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/splash");
  }, [router, signOut]);

  useEffect(() => {
    void refreshStatus();
    void refreshPermissions();
  }, [refreshPermissions, refreshStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshPermissions();
    }, [refreshPermissions]),
  );

  const refreshing = loadingStatus || loadingPermissions;
  const notificationMeta = permissionMeta(
    notificationStatus,
    notificationCanAskAgain,
  );
  const locationMeta = permissionMeta(locationStatus, locationCanAskAgain);

  const sectionContent = useMemo(() => {
    if (!session) return null;

    if (activeSection === "permissions") {
      return (
        <View style={styles.sectionStack}>
          <View style={styles.cardBase}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Notificaciones push</Text>
                <Text style={styles.cardText}>
                  Recibe avisos de aprobaciones, recordatorios y novedades del equipo.
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: notificationMeta.backgroundColor,
                    borderColor: notificationMeta.borderColor,
                  },
                ]}
              >
                <Text style={[styles.statusPillText, { color: notificationMeta.color }]}>
                  {notificationMeta.label}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryAction, requestingNotifications && styles.disabledAction]}
              disabled={requestingNotifications}
              onPress={requestNotificationPermission}
            >
              {requestingNotifications ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryActionText}>
                  {notificationStatus === "granted"
                    ? "Volver a validar"
                    : notificationStatus === "denied" &&
                        notificationCanAskAgain === false
                      ? "Abrir ajustes"
                      : "Activar notificaciones"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardBase}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Ubicación</Text>
                <Text style={styles.cardText}>
                  Permite validar check-in y check-out con la posición real del dispositivo.
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: locationMeta.backgroundColor,
                    borderColor: locationMeta.borderColor,
                  },
                ]}
              >
                <Text style={[styles.statusPillText, { color: locationMeta.color }]}>
                  {locationMeta.label}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryAction, requestingLocation && styles.disabledAction]}
              disabled={requestingLocation}
              onPress={requestLocationPermission}
            >
              {requestingLocation ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryActionText}>
                  {locationStatus === "granted"
                    ? "Volver a validar"
                    : locationStatus === "denied" && locationCanAskAgain === false
                      ? "Abrir ajustes"
                      : "Activar ubicación"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.secondaryAction} onPress={openSystemSettings}>
            <Ionicons name="settings-outline" size={16} color={COLORS.text} />
            <Text style={styles.secondaryActionText}>Abrir ajustes del sistema</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeSection === "privacy") {
      return (
        <View style={styles.sectionStack}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Gestion de datos personales</Text>
            <Text style={styles.infoText}>
              {ANIMA_COPY.settingsManageAccountBody}
            </Text>
          </View>

          <DataCleanupFlow
            submitting={submitting}
            onRequestDataCleanup={async () => {
              const result = await requestDataCleanup();
              if (!result.success) {
                Alert.alert("Error", result.error || "No se pudo procesar la limpieza.");
              }
              return result;
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.sectionStack}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Seguridad de cuenta</Text>
          <Text style={styles.infoText}>
            Aquí puedes cerrar sesión o programar la eliminación total de tu cuenta.
          </Text>
        </View>

        {canOpenAnimaDiagnostics ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Diagnóstico ANIMA</Text>
            <Text style={styles.infoText}>
              Panel privado para validar asistencia, turnos publicados, geocerca y contexto operativo.
            </Text>

            <TouchableOpacity style={styles.secondaryAction} onPress={openAnimaDiagnostics}>
              <Ionicons name="bug-outline" size={16} color={COLORS.text} />
              <Text style={styles.secondaryActionText}>Abrir diagnóstico</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.signOutAction} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={16} color="#fff" />
          <Text style={styles.signOutActionText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={styles.dangerHeader}>
          <Text style={styles.dangerTitle}>Zona de riesgo</Text>
          {loadingStatus ? <ActivityIndicator color={COLORS.accent} /> : null}
        </View>

        <DeleteAccountFlow
          session={session}
          pendingRequest={pendingRequest}
          submitting={submitting}
          onRequestFullDeletion={requestFullDeletion}
          onCancelFullDeletion={cancelFullDeletion}
        />
      </View>
    );
  }, [
    activeSection,
    canOpenAnimaDiagnostics,
    cancelFullDeletion,
    handleSignOut,
    loadingStatus,
    locationMeta.backgroundColor,
    locationMeta.borderColor,
    locationMeta.color,
    locationMeta.label,
    locationStatus,
    notificationMeta.backgroundColor,
    notificationMeta.borderColor,
    notificationMeta.color,
    notificationMeta.label,
    notificationCanAskAgain,
    notificationStatus,
    openAnimaDiagnostics,
    openSystemSettings,
    pendingRequest,
    requestDataCleanup,
    requestFullDeletion,
    requestLocationPermission,
    requestNotificationPermission,
    locationCanAskAgain,
    requestingLocation,
    requestingNotifications,
    session,
    submitting,
  ]);

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.porcelain} />
        <View style={styles.centered}>
          <Text style={styles.pageTitle}>Configuración</Text>
          <Text style={styles.mutedText}>No hay sesión activa.</Text>
          <TouchableOpacity style={styles.primaryAction} onPress={() => router.back()}>
            <Text style={styles.primaryActionText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.porcelain} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backInline} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={COLORS.accent} />
          <Text style={styles.backInlineText}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Configuración</Text>
        <Text style={styles.pageSubtitle}>
          Ajusta permisos, privacidad y cuenta desde un solo lugar.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshStatus();
              void refreshPermissions();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionTabsWrap}>
          {SECTION_TABS.map((tab) => {
            const active = activeSection === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveSection(tab.key)}
                style={[
                  styles.sectionTab,
                  active ? styles.sectionTabActive : styles.sectionTabInactive,
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={active ? COLORS.accent : COLORS.neutral}
                />
                <Text style={[styles.sectionTabText, active ? styles.sectionTabTextActive : null]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sectionContent}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 8,
  },
  backInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backInlineText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: COLORS.neutral,
    fontSize: 13,
    lineHeight: 18,
  },
  mutedText: {
    color: COLORS.neutral,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
  },
  sectionTabsWrap: {
    flexDirection: "row",
    gap: 8,
  },
  sectionTab: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
  },
  sectionTabActive: {
    borderColor: "rgba(226, 0, 106, 0.35)",
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  sectionTabInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTabTextActive: {
    color: COLORS.accent,
  },
  sectionStack: {
    gap: 12,
  },
  cardBase: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  cardText: {
    color: COLORS.neutral,
    fontSize: 12,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  infoText: {
    color: COLORS.neutral,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryAction: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  signOutAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    paddingVertical: 12,
  },
  signOutActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  disabledAction: {
    opacity: 0.6,
  },
  dangerHeader: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dangerTitle: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
