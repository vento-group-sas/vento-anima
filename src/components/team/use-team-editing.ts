import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import type { EditFormState, EmployeeRow } from "@/components/team/types";

type EmployeeSiteRow = {
  site_id: string;
  is_primary: boolean | null;
  is_active: boolean | null;
  sites?: { id: string; name: string } | null;
};

type EmployeeSiteRowDb = Omit<EmployeeSiteRow, "sites"> & {
  sites?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type UseTeamEditingArgs = {
  canManageTeam: boolean;
  canViewAllSites: boolean;
  canAssignRole: (targetRole: string) => boolean;
  isOwner: boolean;
  isManager: boolean;
  managerSiteId: string | null;
  ownerRole: string;
  managementRoles: Set<string>;
  userId: string | undefined;
  loadEmployees: () => Promise<void>;
};

const INITIAL_FORM: EditFormState = {
  fullName: "",
  alias: "",
  role: "",
  isActive: true,
  primarySiteId: null,
  siteIds: [],
};

export function useTeamEditing({
  canManageTeam,
  canViewAllSites,
  canAssignRole,
  isOwner,
  isManager,
  managerSiteId,
  ownerRole,
  managementRoles,
  userId,
  loadEmployees,
}: UseTeamEditingArgs) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState<EditFormState>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const closeEdit = useCallback(() => {
    setIsEditOpen(false);
    setEditingEmployee(null);
  }, []);

  const updateForm = useCallback((patch: Partial<EditFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleSiteSelection = useCallback((siteId: string) => {
    setForm((prev) => {
      const exists = prev.siteIds.includes(siteId);
      const nextIds = exists
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId];

      let nextPrimary = prev.primarySiteId;
      if (!nextIds.includes(nextPrimary ?? "")) {
        nextPrimary = nextIds[0] ?? null;
      }

      return { ...prev, siteIds: nextIds, primarySiteId: nextPrimary };
    });
  }, []);

  const setPrimarySite = useCallback((siteId: string) => {
    setForm((prev) => {
      const nextIds = prev.siteIds.includes(siteId)
        ? prev.siteIds
        : [...prev.siteIds, siteId];
      return { ...prev, siteIds: nextIds, primarySiteId: siteId };
    });
  }, []);

  const saveEmployeeSites = useCallback(
    async (employeeId: string, siteIds: string[], primarySiteId: string) => {
      if (!canViewAllSites) return;

      const uniqueIds = Array.from(new Set(siteIds));
      const finalIds = uniqueIds.length ? uniqueIds : [primarySiteId];

      const { data: current, error: currentError } = await supabase
        .from("employee_sites")
        .select("site_id")
        .eq("employee_id", employeeId);

      if (currentError) throw currentError;

      const currentIds = (current ?? []).map((row) => row.site_id);
      const toRemove = currentIds.filter((id) => !finalIds.includes(id));

      if (toRemove.length) {
        const { error: deleteError } = await supabase
          .from("employee_sites")
          .delete()
          .eq("employee_id", employeeId)
          .in("site_id", toRemove);

        if (deleteError) throw deleteError;
      }

      const { error: clearPrimaryError } = await supabase
        .from("employee_sites")
        .update({ is_primary: false })
        .eq("employee_id", employeeId)
        .eq("is_primary", true)
        .neq("site_id", primarySiteId);

      if (clearPrimaryError) throw clearPrimaryError;

      const payload = finalIds.map((id) => ({
        employee_id: employeeId,
        site_id: id,
        is_primary: id === primarySiteId,
        is_active: true,
      }));

      if (payload.length) {
        const { error: upsertError } = await supabase
          .from("employee_sites")
          .upsert(payload, { onConflict: "employee_id,site_id" });

        if (upsertError) throw upsertError;
      }
    },
    [canViewAllSites],
  );

  const syncEmployeeSelectedSite = useCallback(
    async (employeeId: string, siteId: string) => {
      const { error } = await supabase.from("employee_settings").upsert(
        {
          employee_id: employeeId,
          selected_site_id: siteId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id" },
      );

      if (error) throw error;
    },
    [],
  );

  const startEdit = useCallback(
    async (item: EmployeeRow) => {
      if (!canManageTeam) return;

      const isSelf = item.id === userId;
      if (!isOwner && item.role === ownerRole && !isSelf) {
        Alert.alert("Equipo", "Solo el propietario puede editar este rol.");
        return;
      }
      if (isManager) {
        if (!managerSiteId || item.site_id !== managerSiteId) {
          Alert.alert("Equipo", "Solo puedes editar trabajadores de tu sede.");
          return;
        }
        if (managementRoles.has(item.role) && !isSelf) {
          Alert.alert("Equipo", "No tienes permisos para editar este rol.");
          return;
        }
      }
      if (!canAssignRole(item.role) && !isSelf) {
        Alert.alert("Equipo", "No tienes permisos para editar este rol.");
        return;
      }

      setEditingEmployee(item);

      let selectedSiteIds: string[] = [];
      let primarySiteId = item.site_id ?? null;

      try {
        const { data, error } = await supabase
          .from("employee_sites")
          .select(
            "site_id, is_primary, is_active, sites:sites!employee_sites_site_id_fkey (id, name)",
          )
          .eq("employee_id", item.id);

        if (!error && data) {
          const normalized = ((data as EmployeeSiteRowDb[]) ?? []).map((row) => ({
            ...row,
            sites: Array.isArray(row.sites) ? row.sites[0] ?? null : row.sites ?? null,
          }));
          const activeSites = normalized.filter((row) => row.is_active !== false);
          selectedSiteIds = activeSites.map((row) => row.site_id);
          primarySiteId =
            activeSites.find((row) => row.is_primary)?.site_id ?? primarySiteId;
        }
      } catch (err) {
        console.error("Employee sites load error:", err);
      }

      if (primarySiteId && !selectedSiteIds.includes(primarySiteId)) {
        selectedSiteIds = [...selectedSiteIds, primarySiteId];
      }

      setForm({
        fullName: item.full_name ?? "",
        alias: item.alias ?? "",
        role: item.role ?? "",
        isActive: item.is_active ?? true,
        primarySiteId,
        siteIds: selectedSiteIds,
      });
      setIsEditOpen(true);
    },
    [
      canAssignRole,
      canManageTeam,
      isManager,
      isOwner,
      managementRoles,
      managerSiteId,
      ownerRole,
      userId,
    ],
  );

  const handleSave = useCallback(async () => {
    if (!editingEmployee) return;

    const isSelf = editingEmployee.id === userId;
    if (!form.fullName.trim()) {
      Alert.alert("Equipo", "Escribe el nombre del trabajador.");
      return;
    }
    if (!form.role) {
      Alert.alert("Equipo", "Selecciona un rol.");
      return;
    }
    if (!canAssignRole(form.role) && !(isSelf && form.role === editingEmployee.role)) {
      Alert.alert("Equipo", "No tienes permisos para asignar ese rol.");
      return;
    }

    let primarySiteId =
      form.primarySiteId ?? form.siteIds[0] ?? editingEmployee.site_id ?? null;

    if (isManager) {
      if (!managerSiteId) {
        Alert.alert("Equipo", "No tienes una sede asignada.");
        return;
      }
      primarySiteId = managerSiteId;
    }

    if (!primarySiteId) {
      Alert.alert("Equipo", "Selecciona una sede principal.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          full_name: form.fullName.trim(),
          alias: form.alias.trim() || null,
          role: form.role,
          site_id: primarySiteId,
          is_active: form.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingEmployee.id);

      if (error) throw error;

      if (!isManager) {
        await saveEmployeeSites(editingEmployee.id, form.siteIds, primarySiteId);
      }

      await syncEmployeeSelectedSite(editingEmployee.id, primarySiteId);

      await loadEmployees();
      closeEdit();
    } catch (err) {
      console.error("Employee update error:", err);
      Alert.alert("Equipo", "No se pudo guardar el trabajador.");
    } finally {
      setIsSaving(false);
    }
  }, [
    canAssignRole,
    closeEdit,
    editingEmployee,
    form,
    isManager,
    loadEmployees,
    managerSiteId,
    saveEmployeeSites,
    syncEmployeeSelectedSite,
    userId,
  ]);

  return {
    isEditOpen,
    editingEmployee,
    form,
    isSaving,
    startEdit,
    closeEdit,
    updateForm,
    toggleSiteSelection,
    setPrimarySite,
    handleSave,
  };
}
