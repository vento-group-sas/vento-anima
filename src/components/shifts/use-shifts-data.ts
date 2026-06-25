import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import {
  isUpcomingShift,
  type ShiftRow,
} from "@/components/shifts/utils";
import type { EmployeeOption, SiteOption } from "@/components/shifts/shift-form";
import type { ShiftForEdit } from "@/components/shifts/EditShiftModal";

function getDateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getShiftSortValue(shift: Pick<ShiftRow, "shift_date" | "start_time">) {
  return new Date(`${shift.shift_date}T${shift.start_time}`).getTime();
}

function getWeekDays() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const day = today.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;

  return Array.from({ length: daysUntilSunday + 1 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const iso = date.toISOString().slice(0, 10);
    const weekday = date.toLocaleDateString("es-CO", { weekday: "long" });

    return {
      date: iso,
      label: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`,
    };
  });
}

export type ManagerShiftRow = ShiftRow & {
  employee_id: string;
  published_at?: string | null;
  employees?: { full_name: string | null } | { full_name: string | null }[];
};

export function getEmployeeName(row: ManagerShiftRow): string {
  const e = row.employees;
  if (!e) return "Empleado";
  const name = Array.isArray(e) ? e[0]?.full_name : e?.full_name;
  return name ?? "Empleado";
}

type UseShiftsDataArgs = {
  userId: string | undefined;
  employeeRole: string | null | undefined;
  employeeSiteId: string | null | undefined;
  canManageShifts: boolean;
  canViewSiteWeek: boolean;
};

export function useShiftsData({
  userId,
  employeeRole,
  employeeSiteId,
  canManageShifts,
  canViewSiteWeek,
}: UseShiftsDataArgs) {
  const SHIFT_CACHE_MS = 5000;
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftForEdit | null>(null);
  const [managerEmployees, setManagerEmployees] = useState<EmployeeOption[]>([]);
  const [managerSites, setManagerSites] = useState<SiteOption[]>([]);
  const [managerRows, setManagerRows] = useState<ManagerShiftRow[]>([]);
  const [expandedManagerDays, setExpandedManagerDays] = useState<Record<string, boolean>>({});
  const [updatingShiftId, setUpdatingShiftId] = useState<string | null>(null);
  const loadShiftsInFlightRef = useRef<Promise<void> | null>(null);
  const loadManagedShiftsInFlightRef = useRef<Promise<void> | null>(null);
  const loadManagerOptionsInFlightRef = useRef<Promise<void> | null>(null);
  const lastShiftsLoadedAtRef = useRef(0);
  const lastManagedShiftsLoadedAtRef = useRef(0);
  const lastManagerOptionsLoadedAtRef = useRef(0);

  const managerSiteId = useMemo(() => {
    if (!canViewSiteWeek) return null;
    return employeeSiteId ?? null;
  }, [canViewSiteWeek, employeeSiteId]);

  const loadManagerOptions = useCallback(async () => {
    if (!userId || !canManageShifts) return;
    if (loadManagerOptionsInFlightRef.current) {
      await loadManagerOptionsInFlightRef.current;
      return;
    }
    if (Date.now() - lastManagerOptionsLoadedAtRef.current < SHIFT_CACHE_MS) return;

    const task = (async () => {
      try {
        let sitesQuery = supabase
          .from("sites")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (employeeRole === "gerente" && managerSiteId) {
          sitesQuery = sitesQuery.eq("id", managerSiteId);
        }
        const { data: sitesData } = await sitesQuery;
        setManagerSites((sitesData as SiteOption[]) ?? []);

        let empQuery = supabase
          .from("employees")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name", { ascending: true });
        if (employeeRole === "gerente" && managerSiteId) {
          empQuery = empQuery.eq("site_id", managerSiteId);
        }
        const { data: empData } = await empQuery;
        setManagerEmployees((empData as EmployeeOption[]) ?? []);
      } catch (e) {
        console.error("[SHIFTS] loadManagerOptions error:", e);
      }
    })();

    loadManagerOptionsInFlightRef.current = task;
    try {
      await task;
      lastManagerOptionsLoadedAtRef.current = Date.now();
    } finally {
      loadManagerOptionsInFlightRef.current = null;
    }
  }, [userId, canManageShifts, employeeRole, managerSiteId]);

  useEffect(() => {
    if ((createModalVisible || editModalVisible) && canManageShifts) {
      void loadManagerOptions();
    }
  }, [createModalVisible, editModalVisible, canManageShifts, loadManagerOptions]);

  const loadManagedShifts = useCallback(async () => {
    if (!userId || !canViewSiteWeek || !managerSiteId) {
      setManagerRows([]);
      return;
    }
    if (loadManagedShiftsInFlightRef.current) {
      await loadManagedShiftsInFlightRef.current;
      return;
    }
    if (Date.now() - lastManagedShiftsLoadedAtRef.current < SHIFT_CACHE_MS) return;

    const task = (async () => {
      try {
        let query = supabase
          .from("employee_shifts")
          .select(
            "id, employee_id, shift_date, start_time, end_time, shift_kind, show_end_as_close, break_minutes, notes, status, site_id, area_id, operational_role, checkin_site_id, checkout_site_id, sites(name), published_at, employees!employee_shifts_employee_id_fkey(full_name)",
          )
          .eq("site_id", managerSiteId)
          .gte("shift_date", getDateOffset(-7))
          .lte("shift_date", getDateOffset(30))
          .order("shift_date", { ascending: true })
          .order("start_time", { ascending: true });
        if (!canManageShifts) {
          query = query.not("published_at", "is", null);
        }
        const { data, error } = await query;
        if (error) throw error;
        setManagerRows((data ?? []) as ManagerShiftRow[]);
      } catch (e) {
        console.error("[SHIFTS] loadManagedShifts error:", e);
        setManagerRows([]);
      }
    })();

    loadManagedShiftsInFlightRef.current = task;
    try {
      await task;
      lastManagedShiftsLoadedAtRef.current = Date.now();
    } finally {
      loadManagedShiftsInFlightRef.current = null;
    }
  }, [userId, canManageShifts, canViewSiteWeek, managerSiteId]);

  const loadShifts = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    if (loadShiftsInFlightRef.current) {
      await loadShiftsInFlightRef.current;
      return;
    }
    if (!opts?.force && Date.now() - lastShiftsLoadedAtRef.current < SHIFT_CACHE_MS) return;

    const task = (async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("employee_shifts")
          .select(
            "id, shift_date, start_time, end_time, shift_kind, show_end_as_close, break_minutes, notes, status, site_id, area_id, operational_role, checkin_site_id, checkout_site_id, sites(name)",
          )
          .eq("employee_id", userId)
          .not("published_at", "is", null)
          .gte("shift_date", getDateOffset(-7))
          .lte("shift_date", getDateOffset(30))
          .order("shift_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (error) throw error;
        setRows(((data ?? []) as ShiftRow[]).slice());
      } catch (error) {
        console.error("[SHIFTS] Error loading shifts:", error);
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    })();

    loadShiftsInFlightRef.current = task;
    try {
      await task;
      lastShiftsLoadedAtRef.current = Date.now();
    } finally {
      loadShiftsInFlightRef.current = null;
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadShifts();
      if (canViewSiteWeek) void loadManagedShifts();
    }, [loadShifts, canViewSiteWeek, loadManagedShifts]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadShifts({ force: true });
      if (canViewSiteWeek) {
        if (loadManagedShiftsInFlightRef.current) {
          await loadManagedShiftsInFlightRef.current;
        } else {
          await loadManagedShifts();
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadShifts, canViewSiteWeek, loadManagedShifts]);

  const openEditShift = useCallback((row: ManagerShiftRow) => {
    setEditingShift({
      id: row.id,
      employee_id: row.employee_id,
      site_id: row.site_id,
      shift_date: row.shift_date,
      start_time: row.start_time,
      end_time: row.end_time,
      shift_kind: row.shift_kind ?? "laboral",
      show_end_as_close: row.show_end_as_close ?? false,
      break_minutes: row.break_minutes ?? 0,
      notes: row.notes,
      published_at: row.published_at ?? null,
    });
    setEditModalVisible(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingShift(null);
  }, []);

  const onEditSuccess = useCallback(() => {
    lastShiftsLoadedAtRef.current = 0;
    lastManagedShiftsLoadedAtRef.current = 0;
    void loadShifts({ force: true });
    void loadManagedShifts();
  }, [loadManagedShifts, loadShifts]);

  const updateShiftStatus = useCallback(
    async (shiftId: string, status: "confirmed" | "cancelled") => {
      setUpdatingShiftId(shiftId);
      try {
        const { error } = await supabase
          .from("employee_shifts")
          .update({ status })
          .eq("id", shiftId);
        if (error) throw error;
        lastShiftsLoadedAtRef.current = 0;
        lastManagedShiftsLoadedAtRef.current = 0;
        await loadShifts({ force: true });
        await loadManagedShifts();
      } catch (e) {
        console.error("[SHIFTS] updateShiftStatus error:", e);
        Alert.alert(
          "Error",
          status === "cancelled"
            ? "No se pudo cancelar el turno."
            : "No se pudo confirmar el turno.",
        );
      } finally {
        setUpdatingShiftId(null);
      }
    },
    [loadManagedShifts, loadShifts],
  );

  const handleConfirmShift = useCallback(
    (row: ManagerShiftRow) => {
      if (row.status !== "scheduled") return;
      void updateShiftStatus(row.id, "confirmed");
    },
    [updateShiftStatus],
  );

  const handleCancelShift = useCallback(
    (row: ManagerShiftRow) => {
      if (row.status !== "scheduled" && row.status !== "confirmed") return;
      Alert.alert(
        "Cancelar turno",
        "¿Seguro que quieres cancelar este turno? El empleado ya no lo verá como programado.",
        [
          { text: "No", style: "cancel" },
          {
            text: "Sí, cancelar",
            style: "destructive",
            onPress: () => void updateShiftStatus(row.id, "cancelled"),
          },
        ],
      );
    },
    [updateShiftStatus],
  );

  const upcomingRows = useMemo(() => {
    const now = new Date();
    return rows.filter((row) => isUpcomingShift(row, now));
  }, [rows]);

  const recentRows = useMemo(() => {
    const now = new Date();
    return [...rows]
      .filter((row) => !isUpcomingShift(row, now))
      .sort((a, b) => getShiftSortValue(b) - getShiftSortValue(a));
  }, [rows]);

  const nextShift = upcomingRows[0] ?? null;

  const personalWeek = useMemo(() => {
    const weekDays = getWeekDays();
    return weekDays.map((day) => ({
      ...day,
      items: rows.filter((row) => row.shift_date === day.date),
    }));
  }, [rows]);

  const managerRowsByDay = useMemo(() => {
    const map = new Map<string, ManagerShiftRow[]>();
    for (const row of managerRows) {
      const list = map.get(row.shift_date) ?? [];
      list.push(row);
      map.set(row.shift_date, list);
    }
    return Array.from(map.entries()).map(([shiftDate, dayRows]) => ({
      shiftDate,
      rows: dayRows,
    }));
  }, [managerRows]);

  const managerWeek = useMemo(() => {
    const weekDays = getWeekDays();
    return weekDays.map((day) => ({
      ...day,
      items: managerRows
        .filter((row) => row.shift_date === day.date)
        .sort((a, b) => getShiftSortValue(a) - getShiftSortValue(b)),
    }));
  }, [managerRows]);

  useEffect(() => {
    if (managerRowsByDay.length === 0) {
      setExpandedManagerDays({});
      return;
    }
    setExpandedManagerDays((prev) => {
      const next: Record<string, boolean> = {};
      for (const day of managerRowsByDay) {
        if (Object.prototype.hasOwnProperty.call(prev, day.shiftDate)) {
          next[day.shiftDate] = prev[day.shiftDate];
        } else {
          next[day.shiftDate] = true;
        }
      }
      return next;
    });
  }, [managerRowsByDay]);

  const toggleManagerDay = useCallback((shiftDate: string) => {
    setExpandedManagerDays((prev) => ({ ...prev, [shiftDate]: !prev[shiftDate] }));
  }, []);

  return {
    rows,
    isLoading,
    isRefreshing,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    editingShift,
    managerEmployees,
    managerSites,
    managerRowsByDay,
    expandedManagerDays,
    updatingShiftId,
    nextShift,
    upcomingRows,
    recentRows,
    personalWeek,
    managerWeek,
    managerSiteId,
    setEditModalVisible,
    openEditShift,
    closeEditModal,
    onEditSuccess,
    onRefresh,
    handleConfirmShift,
    handleCancelShift,
    toggleManagerDay,
    loadShifts,
  };
}
