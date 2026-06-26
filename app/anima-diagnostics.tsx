import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";

const QA_ALLOWED_EMAILS = new Set([
  "carlosaaibarra@gmail.com",
  "nathalia@ventocafe.com",
]);

type EmployeeRow = Record<string, any>;
type ShiftRow = Record<string, any>;
type SiteRow = Record<string, any>;
type PushTokenRow = Record<string, any>;
type PushTokenCoverageRow = Record<string, any>;
type LastAttendanceLogRow = Record<string, any>;

type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type DiagnosticState = {
  loading: boolean;
  employees: EmployeeRow[];
  selectedEmployee: EmployeeRow | null;
  shifts: ShiftRow[];
  sitesById: Record<string, SiteRow>;
  lastAttendanceLog: LastAttendanceLogRow | null;
  tokenRows: PushTokenRow[];
  pushTokenCoverageRows: PushTokenCoverageRow[];
  error: string | null;
};

function canAccessAnimaDiagnostics(email: string | null | undefined) {
  return QA_ALLOWED_EMAILS.has(String(email ?? "").trim().toLowerCase());
}

function getDateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function uniqueIds(values: unknown[]) {
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const value of values) {
    const id = cleanId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
  }

  return resolved;
}

function getEmployeeName(row: EmployeeRow | null) {
  if (!row) return "Empleado";
  return row.full_name ?? row.fullName ?? row.name ?? row.email ?? "Empleado";
}

function getEmployeeRole(row: EmployeeRow | null) {
  if (!row) return "Sin rol";
  return row.role ?? row.operational_role ?? row.employee_role ?? "Sin rol";
}

function getEmployeeActive(row: EmployeeRow | null) {
  if (!row) return null;
  if (typeof row.is_active === "boolean") return row.is_active;
  if (typeof row.isActive === "boolean") return row.isActive;
  return null;
}

function getSiteName(site: SiteRow | null | undefined) {
  return site?.name ?? site?.site_name ?? "Sin nombre";
}

function getSiteRadius(site: SiteRow | null | undefined) {
  const raw =
    site?.checkin_radius_meters ??
    site?.radius_meters ??
    site?.radiusMeters ??
    site?.geofence_radius_meters ??
    null;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getSiteCoordinates(site: SiteRow | null | undefined) {
  const latitude = Number(site?.latitude);
  const longitude = Number(site?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function metersBetween(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLon = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatBoolean(value: boolean | null) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "Sin dato";
}

function formatDate(value: unknown) {
  if (!value) return "Sin fecha";
  const date = new Date(`${String(value)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  const weekday = date.toLocaleDateString("es-CO", { weekday: "short" });
  const day = date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });

  return `${weekday} ${day}`;
}

function formatDateTime(value: unknown) {
  if (!value) return "Sin dato";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShiftTime(value: unknown) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function getShiftTimeLabel(shift: ShiftRow | null) {
  if (!shift) return "Sin horario";
  if (shift.shift_kind === "descanso") return "Descanso";
  return `${formatShiftTime(shift.start_time)} - ${formatShiftTime(shift.end_time)}`;
}

function getPrimaryShift(shifts: ShiftRow[]) {
  const workShift = shifts.find((shift) => shift.shift_kind !== "descanso");
  return workShift ?? shifts[0] ?? null;
}

function getShiftLabel(shift: ShiftRow | null) {
  if (!shift) return "No encontrado";
  if (shift.shift_kind === "descanso") return "Descanso";
  return "Publicado";
}

function getOperationalRole(shift: ShiftRow | null, employee: EmployeeRow | null) {
  return shift?.operational_role ?? employee?.operational_role ?? employee?.role ?? "Sin rol operativo";
}

function getShiftSiteIds(shift: ShiftRow | null) {
  const operationalSiteId = cleanId(shift?.site_id);
  const checkInSiteId = cleanId(shift?.checkin_site_id) ?? operationalSiteId;
  const checkOutSiteId = cleanId(shift?.checkout_site_id) ?? operationalSiteId;

  return {
    operationalSiteId,
    checkInSiteId,
    checkOutSiteId,
  };
}

function getSiteStatus(args: {
  deviceLocation: DeviceLocation | null;
  site: SiteRow | null | undefined;
}) {
  const siteLocation = getSiteCoordinates(args.site);
  const radius = getSiteRadius(args.site);

  if (!args.site) return "Sin sede";
  if (!siteLocation) return "Sin coordenadas";
  if (!args.deviceLocation) return "No medido";
  if (!radius) return "Sin radio";

  const distance = metersBetween(args.deviceLocation, siteLocation);
  return distance <= radius
    ? `Dentro del radio (${distance}m / ${radius}m)`
    : `Fuera del radio (${distance}m / ${radius}m)`;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "No se pudo serializar el diagnóstico.";
  }
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "neutral" | "bad";
}) {
  const meta = {
    ok: {
      color: "#0F766E",
      backgroundColor: "#ECFEFF",
      borderColor: "#99F6E4",
    },
    warn: {
      color: "#B45309",
      backgroundColor: "#FFFBEB",
      borderColor: "#FDE68A",
    },
    neutral: {
      color: COLORS.neutral,
      backgroundColor: COLORS.porcelainAlt,
      borderColor: COLORS.border,
    },
    bad: {
      color: COLORS.accent,
      backgroundColor: "#FDF2F8",
      borderColor: "#FBCFE8",
    },
  }[tone];

  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: meta.backgroundColor,
          borderColor: meta.borderColor,
        },
      ]}
    >
      <Text style={[styles.statusPillText, { color: meta.color }]}>{label}</Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong ? styles.infoValueStrong : null]}>{value}</Text>
    </View>
  );
}

function TechnicalBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.codeText}>{safeJson(value)}</Text>
    </View>
  );
}

export default function AnimaDiagnosticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, employee } = useAuth();
  const isAllowed = canAccessAnimaDiagnostics(user?.email);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    cleanId(employee?.id) ?? cleanId(user?.id),
  );
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [state, setState] = useState<DiagnosticState>({
    loading: false,
    employees: [],
    selectedEmployee: null,
    shifts: [],
    sitesById: {},
    lastAttendanceLog: null,
    tokenRows: [],
    pushTokenCoverageRows: [],
    error: null,
  });

  const loadDiagnostics = useCallback(async () => {
    if (!user?.id || !isAllowed) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const targetEmployeeId = selectedEmployeeId ?? cleanId(employee?.id) ?? cleanId(user.id);
      if (!targetEmployeeId) throw new Error("No se pudo determinar el empleado a revisar.");

      const startDate = getDateOffset(0);
      const endDate = getDateOffset(30);

      const employeesResult = await supabase
        .from("employees")
        .select("*")
        .order("full_name", { ascending: true })
        .limit(150);

      if (employeesResult.error) throw employeesResult.error;

      const employees = employeesResult.data ?? [];
      const selectedEmployee =
        employees.find((row: EmployeeRow) => cleanId(row.id) === targetEmployeeId) ?? null;

      const [shiftsResult, lastLogResult, tokensResult, tokenCoverageResult] = await Promise.all([
        supabase
          .from("employee_shifts")
          .select("*")
          .eq("employee_id", targetEmployeeId)
          .gte("shift_date", startDate)
          .lte("shift_date", endDate)
          .not("published_at", "is", null)
          .order("shift_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("attendance_logs")
          .select("action, occurred_at, site_id, shift_id, source, device_info, sites(name)")
          .eq("employee_id", targetEmployeeId)
          .order("occurred_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("anima_diagnostic_employee_push_tokens", {
          p_employee_id: targetEmployeeId,
        }),
        supabase.rpc("anima_diagnostic_push_token_coverage"),
      ]);

      if (shiftsResult.error) throw shiftsResult.error;
      if (lastLogResult.error) throw lastLogResult.error;
      if (tokensResult.error) throw tokensResult.error;
      if (tokenCoverageResult.error) throw tokenCoverageResult.error;

      const shifts = shiftsResult.data ?? [];
      const siteIds = uniqueIds(
        shifts.flatMap((shift: ShiftRow) => [
          shift.site_id,
          shift.checkin_site_id,
          shift.checkout_site_id,
        ]),
      );

      let sitesById: Record<string, SiteRow> = {};
      if (siteIds.length > 0) {
        const sitesResult = await supabase.from("sites").select("*").in("id", siteIds);
        if (sitesResult.error) throw sitesResult.error;

        sitesById = Object.fromEntries(
          (sitesResult.data ?? [])
            .map((site: SiteRow) => {
              const id = cleanId(site.id);
              return id ? [id, site] : null;
            })
            .filter(Boolean) as Array<[string, SiteRow]>,
        );
      }

      setState({
        loading: false,
        employees,
        selectedEmployee,
        shifts,
        sitesById,
        lastAttendanceLog: lastLogResult.data ?? null,
        tokenRows: tokensResult.data ?? [],
        pushTokenCoverageRows: tokenCoverageResult.data ?? [],
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Error cargando diagnóstico.",
      }));
    }
  }, [employee?.id, isAllowed, selectedEmployeeId, user?.id]);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  useFocusEffect(
    useCallback(() => {
      void loadDiagnostics();
    }, [loadDiagnostics]),
  );

  useEffect(() => {
    if (state.shifts.length === 0) {
      if (selectedShiftId) setSelectedShiftId(null);
      return;
    }

    const selectedExists = state.shifts.some((shift) => cleanId(shift.id) === selectedShiftId);
    if (selectedExists) return;

    const firstWorkShift = getPrimaryShift(state.shifts);
    setSelectedShiftId(cleanId(firstWorkShift?.id));
  }, [selectedShiftId, state.shifts]);

  const checkDeviceLocation = useCallback(async () => {
    setCheckingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setDeviceLocation(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setDeviceLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? null,
      });
    } finally {
      setCheckingLocation(false);
    }
  }, []);

  const selectedShift = useMemo(() => {
    const byId = state.shifts.find((shift) => cleanId(shift.id) === selectedShiftId);
    return byId ?? getPrimaryShift(state.shifts);
  }, [selectedShiftId, state.shifts]);

  const selectedSiteIds = useMemo(
    () => getShiftSiteIds(selectedShift),
    [selectedShift],
  );

  const operationalSite = selectedSiteIds.operationalSiteId
    ? state.sitesById[selectedSiteIds.operationalSiteId]
    : null;
  const checkInSite = selectedSiteIds.checkInSiteId
    ? state.sitesById[selectedSiteIds.checkInSiteId]
    : null;
  const checkOutSite = selectedSiteIds.checkOutSiteId
    ? state.sitesById[selectedSiteIds.checkOutSiteId]
    : null;

  const activeTokens = state.tokenRows.filter((row) => row.is_active === true);
  const latestToken = state.tokenRows[0] ?? null;
  const employeesWithActivePushToken = state.pushTokenCoverageRows.filter(
    (row) => row.has_active_token === true,
  );
  const employeesWithoutActivePushToken = state.pushTokenCoverageRows.filter(
    (row) => row.has_active_token !== true,
  );
  const missingPushTokenPreview = employeesWithoutActivePushToken
    .slice(0, 8)
    .map((row) => row.full_name ?? row.alias ?? row.employee_id)
    .join(", ");
  const operationalRole = getOperationalRole(selectedShift, state.selectedEmployee);
  const isConductorLike = String(operationalRole).toLowerCase().includes("conductor");
  const hasDifferentCheckInSite =
    !!selectedSiteIds.operationalSiteId &&
    !!selectedSiteIds.checkInSiteId &&
    selectedSiteIds.operationalSiteId !== selectedSiteIds.checkInSiteId;
  const hasDifferentCheckOutSite =
    !!selectedSiteIds.operationalSiteId &&
    !!selectedSiteIds.checkOutSiteId &&
    selectedSiteIds.operationalSiteId !== selectedSiteIds.checkOutSiteId;

  const conductorTone: "ok" | "warn" | "neutral" | "bad" =
    !selectedShift || selectedShift.shift_kind === "descanso"
      ? "neutral"
      : isConductorLike && (hasDifferentCheckInSite || hasDifferentCheckOutSite)
        ? "ok"
        : isConductorLike
          ? "warn"
          : "neutral";

  const conductorLabel =
    !selectedShift
      ? "Sin turno"
      : selectedShift.shift_kind === "descanso"
        ? "Descanso"
        : isConductorLike && (hasDifferentCheckInSite || hasDifferentCheckOutSite)
          ? "Conductor configurado"
          : isConductorLike
            ? "Conductor sin puntos separados"
            : "No es conductor";

  const attendanceContext =
    state.lastAttendanceLog?.device_info?.attendanceContext ??
    state.lastAttendanceLog?.device_info?.attendance_context ??
    null;

  if (!isAllowed) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.porcelain} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed-outline" size={26} color={COLORS.accent} />
          <Text style={styles.pageTitle}>Acceso restringido</Text>
          <Text style={styles.pageSubtitle}>
            Este diagnóstico está habilitado solo para la cuenta autorizada.
          </Text>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.back()}>
            <Text style={styles.secondaryActionText}>Volver</Text>
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

        <Text style={styles.pageTitle}>Diagnóstico ANIMA</Text>
        <Text style={styles.pageSubtitle}>
          Selecciona un empleado y un turno publicado para revisar el caso conductor.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={state.loading} onRefresh={loadDiagnostics} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Modo auditoría</Text>
          <Text style={styles.noticeText}>
            No valida solo tu cuenta. Selecciona el empleado y luego el turno que quieres revisar.
            La consulta trae turnos publicados desde hoy hasta los próximos 30 días.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryAction, state.loading && styles.disabledAction]}
            disabled={state.loading}
            onPress={loadDiagnostics}
          >
            {state.loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryActionText}>Refrescar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            disabled={checkingLocation}
            onPress={checkDeviceLocation}
          >
            {checkingLocation ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="locate-outline" size={16} color={COLORS.text} />
                <Text style={styles.secondaryActionText}>Probar mi GPS</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {state.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Empleado a revisar</Text>
            <StatusPill
              label={`${state.employees.length} disponibles`}
              tone={state.employees.length > 0 ? "ok" : "neutral"}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.employeeList}>
            {state.employees.map((row) => {
              const id = cleanId(row.id);
              const selected = id === selectedEmployeeId;
              return (
                <TouchableOpacity
                  key={id ?? getEmployeeName(row)}
                  style={[styles.employeeChip, selected ? styles.employeeChipActive : null]}
                  onPress={() => {
                    setSelectedEmployeeId(id);
                    setSelectedShiftId(null);
                  }}
                >
                  <Text style={[styles.employeeChipName, selected ? styles.employeeChipNameActive : null]}>
                    {getEmployeeName(row)}
                  </Text>
                  <Text style={styles.employeeChipRole}>{getEmployeeRole(row)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <InfoRow label="Seleccionado" value={getEmployeeName(state.selectedEmployee)} strong />
          <InfoRow label="Rol base" value={getEmployeeRole(state.selectedEmployee)} />
          <InfoRow label="Activo" value={formatBoolean(getEmployeeActive(state.selectedEmployee))} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Turno a auditar</Text>
            <StatusPill
              label={`${state.shifts.length} publicados`}
              tone={state.shifts.length > 0 ? "ok" : "warn"}
            />
          </View>

          {state.shifts.length === 0 ? (
            <Text style={styles.helpText}>
              Este empleado no tiene turnos publicados desde hoy hasta los próximos 30 días.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shiftList}>
              {state.shifts.map((shift) => {
                const id = cleanId(shift.id);
                const selected = cleanId(selectedShift?.id) === id;
                return (
                  <TouchableOpacity
                    key={id ?? `${shift.shift_date}-${shift.start_time}`}
                    style={[styles.shiftChip, selected ? styles.shiftChipActive : null]}
                    onPress={() => setSelectedShiftId(id)}
                  >
                    <Text style={[styles.shiftChipDate, selected ? styles.shiftChipDateActive : null]}>
                      {formatDate(shift.shift_date)}
                    </Text>
                    <Text style={styles.shiftChipTime}>{getShiftTimeLabel(shift)}</Text>
                    <Text style={styles.shiftChipRole} numberOfLines={2}>
                      {getOperationalRole(shift, state.selectedEmployee)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <InfoRow
            label="Turno seleccionado"
            value={
              selectedShift
                ? `${formatDate(selectedShift.shift_date)} · ${getShiftTimeLabel(selectedShift)}`
                : "Sin turno"
            }
            strong
          />
          <InfoRow label="Tipo" value={selectedShift?.shift_kind ?? "Sin dato"} />
          <InfoRow label="Estado" value={selectedShift?.status ?? "Sin dato"} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Validación conductor</Text>
            <StatusPill label={conductorLabel} tone={conductorTone} />
          </View>

          <InfoRow label="Turno seleccionado" value={getShiftLabel(selectedShift)} strong />
          <InfoRow label="Rol operativo" value={String(operationalRole)} />
          <InfoRow label="Sede donde se guarda asistencia" value={getSiteName(operationalSite)} />
          <InfoRow label="Entrada valida contra" value={getSiteName(checkInSite)} strong />
          <InfoRow label="Salida valida contra" value={getSiteName(checkOutSite)} strong />
          <InfoRow
            label="Regla esperada"
            value={
              hasDifferentCheckInSite || hasDifferentCheckOutSite
                ? "OK: guarda en sede operativa y valida GPS contra puntos separados."
                : "Usa la misma sede para guardar asistencia y validar GPS."
            }
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Prueba con tu GPS</Text>
            <StatusPill label={deviceLocation ? "GPS leído" : "No medido"} tone={deviceLocation ? "ok" : "neutral"} />
          </View>

          <InfoRow
            label="Precisión del celular"
            value={deviceLocation?.accuracy != null ? `${Math.round(deviceLocation.accuracy)}m` : "Sin lectura"}
          />
          <InfoRow
            label="Entrada"
            value={getSiteStatus({ deviceLocation, site: checkInSite })}
            strong
          />
          <InfoRow
            label="Salida"
            value={getSiteStatus({ deviceLocation, site: checkOutSite })}
            strong
          />
          <Text style={styles.helpText}>
            Esta prueba usa tu celular. Sirve para saber si físicamente estás dentro del punto configurado.
            No simula el celular del conductor.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Notificaciones</Text>
            <StatusPill
              label={activeTokens.length > 0 ? "Token activo" : "Sin token activo"}
              tone={activeTokens.length > 0 ? "ok" : "bad"}
            />
          </View>

          <InfoRow label="Tokens activos" value={String(activeTokens.length)} strong />
          <InfoRow label="Última actualización" value={formatDateTime(latestToken?.updated_at ?? latestToken?.created_at)} />
          <InfoRow label="Token" value={latestToken?.token_preview ?? "Sin token"} />
          <InfoRow
            label="Resultado"
            value={
              activeTokens.length > 0
                ? "Este usuario debería poder recibir push si el backend envía a este token."
                : "Este usuario tiene permisos posibles, pero no hay token activo registrado."
            }
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Cobertura de tokens</Text>
            <StatusPill
              label={`${employeesWithActivePushToken.length}/${state.pushTokenCoverageRows.length} activos`}
              tone={employeesWithoutActivePushToken.length === 0 ? "ok" : "warn"}
            />
          </View>

          <InfoRow
            label="Trabajadores activos con token"
            value={String(employeesWithActivePushToken.length)}
            strong
          />
          <InfoRow
            label="Trabajadores activos sin token"
            value={String(employeesWithoutActivePushToken.length)}
            strong
          />
          <InfoRow
            label="Primeros pendientes"
            value={missingPushTokenPreview || "Sin pendientes"}
          />
          <Text style={styles.helpText}>
            Para recuperar un token faltante, el trabajador debe abrir ANIMA con internet. Si el permiso ya esta activo,
            Home mostrara Reparar notificaciones y tambien intentara registrarlo automaticamente.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Última asistencia</Text>
            <StatusPill
              label={state.lastAttendanceLog ? "Encontrada" : "Sin registros"}
              tone={state.lastAttendanceLog ? "ok" : "neutral"}
            />
          </View>

          <InfoRow label="Acción" value={state.lastAttendanceLog?.action ?? "Sin dato"} />
          <InfoRow label="Hora" value={formatDateTime(state.lastAttendanceLog?.occurred_at)} />
          <InfoRow
            label="Sede guardada"
            value={
              state.lastAttendanceLog?.sites?.name ??
              state.lastAttendanceLog?.site_id ??
              "Sin dato"
            }
          />
          <InfoRow
            label="Contexto de geocerca"
            value={
              attendanceContext?.geofenceSiteId
                ? `Usó geocerca ${attendanceContext.geofenceSiteId}`
                : "Aún no hay contexto nuevo guardado"
            }
          />
        </View>

        <TouchableOpacity
          style={styles.technicalToggle}
          onPress={() => setShowTechnical((prev) => !prev)}
        >
          <Ionicons
            name={showTechnical ? "chevron-up-outline" : "chevron-down-outline"}
            size={16}
            color={COLORS.text}
          />
          <Text style={styles.technicalToggleText}>
            {showTechnical ? "Ocultar datos técnicos" : "Ver datos técnicos"}
          </Text>
        </TouchableOpacity>

        {showTechnical ? (
          <>
            <TechnicalBlock title="Empleado seleccionado" value={state.selectedEmployee} />
            <TechnicalBlock title="Turnos publicados del rango" value={state.shifts} />
            <TechnicalBlock title="Turno seleccionado" value={selectedShift} />
            <TechnicalBlock title="Sedes cargadas" value={state.sitesById} />
            <TechnicalBlock title="Último attendance_logs" value={state.lastAttendanceLog} />
            <TechnicalBlock title="Tokens push (enmascarados)" value={state.tokenRows} />
            <TechnicalBlock title="Cobertura tokens push" value={state.pushTokenCoverageRows} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  denied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 12,
  },
  noticeCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  noticeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    color: COLORS.neutral,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  disabledAction: {
    opacity: 0.6,
  },
  errorCard: {
    backgroundColor: "#FDF2F8",
    borderColor: "#FBCFE8",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  employeeList: {
    gap: 8,
    paddingVertical: 2,
  },
  employeeChip: {
    width: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 10,
    gap: 4,
  },
  employeeChipActive: {
    borderColor: "rgba(226, 0, 106, 0.35)",
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  employeeChipName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },
  employeeChipNameActive: {
    color: COLORS.accent,
  },
  employeeChipRole: {
    color: COLORS.neutral,
    fontSize: 11,
  },
  shiftList: {
    gap: 8,
    paddingVertical: 2,
  },
  shiftChip: {
    width: 154,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 10,
    gap: 4,
  },
  shiftChipActive: {
    borderColor: "rgba(226, 0, 106, 0.35)",
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  shiftChipDate: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },
  shiftChipDateActive: {
    color: COLORS.accent,
  },
  shiftChipTime: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  shiftChipRole: {
    color: COLORS.neutral,
    fontSize: 11,
    lineHeight: 15,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 9,
    gap: 4,
  },
  infoLabel: {
    color: COLORS.neutral,
    fontSize: 11,
    fontWeight: "700",
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  infoValueStrong: {
    fontWeight: "800",
  },
  helpText: {
    color: COLORS.neutral,
    fontSize: 11,
    lineHeight: 17,
  },
  technicalToggle: {
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
  technicalToggleText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  block: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  blockTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  codeText: {
    color: COLORS.text,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Courier",
  },
});
