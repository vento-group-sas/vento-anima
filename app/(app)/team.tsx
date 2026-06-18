import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useRoleCapabilities } from "@/hooks/use-role-capabilities";
import TeamEmptyState from "@/components/team/TeamEmptyState";
import TeamMemberCard from "@/components/team/TeamMemberCard";
import PendingInvitationsSection from "@/components/team/PendingInvitationsSection";
import TeamEditModal from "@/components/team/TeamEditModal";
import TeamInviteModal from "@/components/team/TeamInviteModal";
import TeamDeleteModal from "@/components/team/TeamDeleteModal";
import { useTeamData } from "@/components/team/use-team-data";
import { useTeamEditing } from "@/components/team/use-team-editing";
import { useTeamInvitations } from "@/components/team/use-team-invitations";
import { TEAM_UI } from "@/components/team/ui";
import { getUserFacingAuthError } from "@/utils/error-messages";
import type {
  EmployeeRow,
} from "@/components/team/types";

const UI = TEAM_UI;

const OWNER_ROLE = "propietario";
const GLOBAL_MANAGER_ROLE = "gerente_general";
const MANAGER_ROLE = "gerente";
const MANAGEMENT_ROLES = new Set([OWNER_ROLE, GLOBAL_MANAGER_ROLE, MANAGER_ROLE]);

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, selectedSiteId } = useAuth();
  const role = employee?.role ?? null;
  const { has: hasCapability, loaded: capabilitiesLoaded } = useRoleCapabilities(role);
  const isOwner = role === OWNER_ROLE;
  const isGlobalManager = role === GLOBAL_MANAGER_ROLE;
  const isManager = role === MANAGER_ROLE;
  const canViewTeam = capabilitiesLoaded
    ? hasCapability("team.view")
    : Boolean(role && MANAGEMENT_ROLES.has(role));
  const canManageTeam = capabilitiesLoaded
    ? hasCapability("team.invite")
    : Boolean(role && MANAGEMENT_ROLES.has(role));
  const canViewAllSites = isOwner || isGlobalManager;
  const canChangeSites = canViewAllSites;
  const ownerDeleteUid = process.env.EXPO_PUBLIC_ANIMA_OWNER_DELETE_UID ?? null;
  const canUseDeleteFlow =
    !!ownerDeleteUid && !!user?.id && user.id === ownerDeleteUid;

  const [search, setSearch] = useState("");
  const [siteFilterId, setSiteFilterId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  const [activePicker, setActivePicker] = useState<
    "editRole" | "editPrimary" | "editSites" | "inviteRole" | "inviteSite" | null
  >(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

  const defaultFilter = useMemo(() => {
    if (canViewAllSites) return null;
    return employee?.siteId ?? selectedSiteId ?? null;
  }, [canViewAllSites, selectedSiteId, employee?.siteId]);

  useEffect(() => {
    setSiteFilterId(defaultFilter);
  }, [defaultFilter]);

  const managerSiteId = useMemo(() => {
    if (!isManager) return null;
    return employee?.siteId ?? selectedSiteId ?? null;
  }, [isManager, selectedSiteId, employee?.siteId]);
  const {
    employees,
    sites,
    roles,
    pendingInvitations,
    isLoading,
    isRefreshing,
    isLoadingInvitations,
    loadEmployees,
    loadInvitations,
    handleRefresh,
  } = useTeamData({
    userId: user?.id,
    canViewTeam,
    isManager,
    managerSiteId,
  });
  const canAssignRole = useCallback(
    (targetRole: string) => {
      if (isOwner) return true;
      if (isGlobalManager) {
        return targetRole !== OWNER_ROLE && targetRole !== GLOBAL_MANAGER_ROLE;
      }
      if (isManager) {
        return !MANAGEMENT_ROLES.has(targetRole);
      }
      return false;
    },
    [isOwner, isGlobalManager, isManager],
  );
  const {
    isEditOpen,
    editingEmployee,
    form,
    isSaving,
    startEdit,
    closeEdit: closeEditBase,
    updateForm,
    toggleSiteSelection,
    setPrimarySite,
    handleSave,
  } = useTeamEditing({
    canManageTeam,
    canViewAllSites,
    canAssignRole,
    isOwner,
    isManager,
    managerSiteId,
    ownerRole: OWNER_ROLE,
    managementRoles: MANAGEMENT_ROLES,
    userId: user?.id,
    loadEmployees,
  });
  const {
    isInviteOpen,
    isInviting,
    inviteEmailSent,
    inviteSuccessMessage,
    inviteForm,
    resendingInvitationId,
    cancellingInvitationId,
    updateInviteForm,
    openInvite: openInviteBase,
    closeInvite: closeInviteBase,
    handleInvite,
    getEffectiveInvitationStatus,
    getInvitationStatusLabel,
    formatInvitationDate,
    handleResendInvitation,
    handleCancelInvitation,
  } = useTeamInvitations({
    canManageTeam,
    canAssignRole,
    isManager,
    managerSiteId,
    selectedSiteId: selectedSiteId ?? null,
    employeeSiteId: employee?.siteId,
    sites,
    loadInvitations,
  });
  const openInvite = useCallback(() => {
    setActivePicker(null);
    setPickerQuery("");
    openInviteBase();
  }, [openInviteBase]);

  const closeInvite = useCallback(() => {
    setActivePicker(null);
    setPickerQuery("");
    closeInviteBase();
  }, [closeInviteBase]);

  const closeEdit = useCallback(() => {
    setActivePicker(null);
    setPickerQuery("");
    closeEditBase();
  }, [closeEditBase]);

  const roleLabel = useCallback(
    (code: string) => {
      const match = roles.find((item) => item.code === code);
      return match?.name ?? code;
    },
    [roles],
  );

  const formatName = (employeeRow: EmployeeRow) => {
    const base = employeeRow.full_name ?? "";
    if (!employeeRow.alias) return base;
    return `${base} (${employeeRow.alias})`;
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((item) => {
      if (siteFilterId && item.site_id !== siteFilterId) return false;
      const isActive = item.is_active !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      if (!query) return true;
      const name = `${item.full_name ?? ""} ${item.alias ?? ""}`.toLowerCase();
      const roleName = roleLabel(item.role).toLowerCase();
      return name.includes(query) || roleName.includes(query);
    });
  }, [employees, search, siteFilterId, statusFilter, roleLabel]);

  const activeEmployeeCount = useMemo(
    () => employees.filter((item) => item.is_active !== false).length,
    [employees],
  );
  const inactiveEmployeeCount = employees.length - activeEmployeeCount;

  const openPicker = (
    picker:
      | "editRole"
      | "editPrimary"
      | "editSites"
      | "inviteRole"
      | "inviteSite",
  ) => {
    setPickerQuery("");
    setActivePicker(picker);
  };

  const closePicker = () => {
    setActivePicker(null);
  };

  const openEditPicker = (picker: "editRole" | "editPrimary" | "editSites") =>
    openPicker(picker);
  const openInvitePicker = (picker: "inviteRole" | "inviteSite") =>
    openPicker(picker);

  const closeDelete = () => {
    setDeletingEmployee(null);
    setDeleteConfirmText("");
    setIsDeletingEmployee(false);
  };

  const startDelete = (item: EmployeeRow) => {
    if (!canUseDeleteFlow) {
      Alert.alert("Equipo", "No tienes permisos para eliminar trabajadores.");
      return;
    }
    if (item.id === user?.id) {
      Alert.alert("Equipo", "No puedes eliminar tu propio usuario.");
      return;
    }
    if (item.role === OWNER_ROLE) {
      Alert.alert("Equipo", "No se puede eliminar otro propietario.");
      return;
    }

    Alert.alert(
      "Eliminar trabajador",
      `Se eliminará permanentemente ${formatName(item)} junto con sus registros. ¿Deseas continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => {
            setDeletingEmployee(item);
            setDeleteConfirmText("");
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!deletingEmployee) return;
    if (deleteConfirmText.trim().toUpperCase() !== "ELIMINAR") return;

    setIsDeletingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-delete", {
        body: {
          target_employee_id: deletingEmployee.id,
        },
      });

      if (error) {
        throw new Error(error.message || "No se pudo eliminar el trabajador");
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }

      await loadEmployees();
      closeDelete();
      Alert.alert("Equipo", "Trabajador eliminado correctamente.");
    } catch (err) {
      console.error("Delete employee error:", err);
      Alert.alert(
        "Equipo",
        getUserFacingAuthError(err, "No se pudo eliminar el trabajador."),
      );
    } finally {
      setIsDeletingEmployee(false);
    }
  };

  const availableRoleOptions = useMemo(() => {
    if (isOwner) return roles;
    if (isGlobalManager) {
      return roles.filter(
        (item) =>
          item.code !== OWNER_ROLE && item.code !== GLOBAL_MANAGER_ROLE,
      );
    }
    if (isManager) {
      return roles.filter((item) => !MANAGEMENT_ROLES.has(item.code));
    }
    return [];
  }, [roles, isOwner, isGlobalManager, isManager]);

  const filteredRoleOptions = useMemo(() => {
    if (!pickerQuery.trim()) return availableRoleOptions;
    const q = pickerQuery.trim().toLowerCase();
    return availableRoleOptions.filter((item) =>
      item.name.toLowerCase().includes(q),
    );
  }, [availableRoleOptions, pickerQuery]);

  const filteredSiteOptions = useMemo(() => {
    if (!pickerQuery.trim()) return sites;
    const q = pickerQuery.trim().toLowerCase();
    return sites.filter((site) => site.name.toLowerCase().includes(q));
  }, [sites, pickerQuery]);

  if (!canViewTeam) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Equipo</Text>
        <Text style={styles.subtitle}>
          No tienes permisos para acceder a esta sección.
        </Text>
      </View>
    );
  }

  const primarySiteLabel = form.primarySiteId
    ? sites.find((site) => site.id === form.primarySiteId)?.name
    : null;
  const normalizedPrimarySiteLabel = primarySiteLabel ?? null;

  const roleName = form.role ? roleLabel(form.role) : null;
  const isEditingSelf = editingEmployee?.id === user?.id;
  const canPickRole = canManageTeam && (!isEditingSelf || canAssignRole(form.role));
  const canPickSites = canChangeSites;

  const showFilters = canViewAllSites && sites.length > 0;

  const editPicker =
    activePicker === "editRole" ||
    activePicker === "editPrimary" ||
    activePicker === "editSites"
      ? activePicker
      : null;
  const invitePicker =
    activePicker === "inviteRole" || activePicker === "inviteSite"
      ? activePicker
      : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(24, insets.bottom + 24),
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Equipo</Text>
            <Text style={styles.subtitle}>
              Gestiona trabajadores y sedes asignadas.
            </Text>
          </View>
          {canManageTeam ? (
            <TouchableOpacity
              onPress={openInvite}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.accent,
                  backgroundColor: "rgba(226, 0, 106, 0.12)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                },
              ]}
            >
              <Ionicons name="person-add-outline" size={16} color={COLORS.accent} />
              <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                Invitar
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginTop: 16 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre o rol"
            placeholderTextColor={COLORS.neutral}
            style={styles.searchInput}
          />
        </View>

        {showFilters ? (
          <View style={{ marginTop: 12 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8 }}
            >
              <TouchableOpacity
                onPress={() => setSiteFilterId(null)}
                style={[
                  UI.chip,
                  {
                    borderColor: siteFilterId ? COLORS.border : COLORS.accent,
                    backgroundColor: siteFilterId
                      ? COLORS.white
                      : "rgba(226, 0, 106, 0.10)",
                    marginRight: 10,
                  },
                ]}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    color: siteFilterId ? COLORS.text : COLORS.accent,
                  }}
                >
                  Todas
                </Text>
              </TouchableOpacity>

              {sites.map((site) => {
                const active = siteFilterId === site.id;
                return (
                  <TouchableOpacity
                    key={site.id}
                    onPress={() => setSiteFilterId(site.id)}
                    style={[
                      UI.chip,
                      {
                        borderColor: active ? COLORS.accent : COLORS.border,
                        backgroundColor: active
                          ? "rgba(226, 0, 106, 0.10)"
                          : COLORS.white,
                        marginRight: 10,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontWeight: "800",
                        color: active ? COLORS.accent : COLORS.text,
                      }}
                    >
                      {site.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.statusTabs}>
          {[
            { key: "active" as const, label: "Activos", count: activeEmployeeCount },
            { key: "inactive" as const, label: "Inactivos", count: inactiveEmployeeCount },
          ].map((option) => {
            const active = statusFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setStatusFilter(option.key)}
                style={[
                  UI.chip,
                  styles.statusTab,
                  active ? styles.statusTabActive : null,
                ]}
              >
                <Text style={[styles.statusTabText, active ? styles.statusTabTextActive : null]}>
                  {option.label}
                </Text>
                <Text style={[styles.statusTabCount, active ? styles.statusTabTextActive : null]}>
                  {option.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={{ paddingTop: 30, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}

        {!isLoading && filteredEmployees.length === 0 ? (
          <TeamEmptyState />
        ) : null}
        <PendingInvitationsSection
          pendingInvitations={pendingInvitations}
          sites={sites}
          isLoadingInvitations={isLoadingInvitations}
          resendingInvitationId={resendingInvitationId}
          cancellingInvitationId={cancellingInvitationId}
          roleLabel={roleLabel}
          getEffectiveInvitationStatus={getEffectiveInvitationStatus}
          getInvitationStatusLabel={getInvitationStatusLabel}
          formatInvitationDate={formatInvitationDate}
          onResendInvitation={handleResendInvitation}
          onCancelInvitation={handleCancelInvitation}
        />

        <View style={{ marginTop: 18, gap: 12 }}>
          {filteredEmployees.map((item) => {
            const isSelf = item.id === user?.id;
            let canEditItem = canManageTeam;

            if (!isOwner && item.role === OWNER_ROLE && !isSelf) {
              canEditItem = false;
            }
            if (isManager) {
              if (!managerSiteId || item.site_id !== managerSiteId) {
                canEditItem = false;
              }
              if (MANAGEMENT_ROLES.has(item.role) && !isSelf) {
                canEditItem = false;
              }
            }
            if (!canAssignRole(item.role) && !isSelf) {
              canEditItem = false;
            }
            const canDeleteItem =
              canUseDeleteFlow && !isSelf && item.role !== OWNER_ROLE;

            return (
              <TeamMemberCard
                key={item.id}
                employee={item}
                formatName={formatName}
                roleLabel={roleLabel}
                canEdit={canEditItem}
                canDelete={canDeleteItem}
                onEdit={() => startEdit(item)}
                onDelete={() => startDelete(item)}
              />
            );
          })}
        </View>
      </ScrollView>
      <TeamEditModal
        visible={isEditOpen}
        insets={insets}
        form={form}
        roleName={roleName}
        primarySiteLabel={normalizedPrimarySiteLabel}
        canPickRole={canPickRole}
        canPickSites={canPickSites}
        isSaving={isSaving}
        activePicker={editPicker}
        pickerQuery={pickerQuery}
        filteredRoleOptions={filteredRoleOptions}
        filteredSiteOptions={filteredSiteOptions}
        onClose={closeEdit}
        onSave={handleSave}
        onOpenPicker={openEditPicker}
        onClosePicker={closePicker}
        onSetPickerQuery={setPickerQuery}
        onUpdateForm={updateForm}
        onToggleSite={toggleSiteSelection}
        onSetPrimarySite={setPrimarySite}
      />

      <TeamInviteModal
        visible={isInviteOpen}
        insets={insets}
        form={inviteForm}
        inviteEmailSent={inviteEmailSent}
        inviteSuccessMessage={inviteSuccessMessage}
        isInviting={isInviting}
        canPickSites={canPickSites}
        inviteRoleLabel={inviteForm.role ? roleLabel(inviteForm.role) : null}
        inviteSiteLabel={
          inviteForm.siteId
            ? sites.find((site) => site.id === inviteForm.siteId)?.name ??
              "Selecciona la sede"
            : null
        }
        activePicker={invitePicker}
        pickerQuery={pickerQuery}
        filteredRoleOptions={filteredRoleOptions}
        filteredSiteOptions={filteredSiteOptions}
        onClose={closeInvite}
        onSubmit={handleInvite}
        onOpenPicker={openInvitePicker}
        onClosePicker={closePicker}
        onSetPickerQuery={setPickerQuery}
        onUpdateForm={updateInviteForm}
      />

      <TeamDeleteModal
        visible={!!deletingEmployee}
        insets={insets}
        employeeName={deletingEmployee ? formatName(deletingEmployee) : ""}
        confirmText={deleteConfirmText}
        isDeleting={isDeletingEmployee}
        onChangeConfirmText={setDeleteConfirmText}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.neutral,
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
    color: COLORS.text,
  },
  statusTabs: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  statusTab: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  statusTabActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  statusTabText: {
    fontWeight: "800",
    color: COLORS.text,
  },
  statusTabTextActive: {
    color: COLORS.accent,
  },
  statusTabCount: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.neutral,
  },
});
