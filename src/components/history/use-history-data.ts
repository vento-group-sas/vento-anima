import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import type {
  AttendanceLog,
  DerivedLog,
} from "@/components/history/types";

export type RangeMode = "week" | "month";

function getRange(anchor: Date, mode: RangeMode) {
  const start = new Date(anchor);
  const end = new Date(anchor);

  if (mode === "week") {
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(start.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatRangeLabel(start: Date, end: Date) {
  const left = start.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
  const right = end.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${left} - ${right}`;
}

function getDayKey(value: string) {
  return value.slice(0, 10);
}

type HistoryDerivedLog = DerivedLog & {
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLogId: string | null;
  checkOutLogId: string | null;
  checkInAccuracyMeters: number | null;
  checkOutAccuracyMeters: number | null;
  checkOutNotes: string | null;
};

function buildHistoryRow(
  log: AttendanceLog,
  statusLabel: DerivedLog["statusLabel"],
  checkOutLog?: AttendanceLog | null,
): HistoryDerivedLog {
  const isCheckIn = log.action === "check_in";
  const fallbackCheckOut = !isCheckIn && !checkOutLog ? log : null;

  return {
    ...log,
    dayKey: getDayKey(log.occurred_at),
    statusLabel,
    durationMinutes: null,
    checkInAt: isCheckIn ? log.occurred_at : null,
    checkOutAt: checkOutLog?.occurred_at ?? fallbackCheckOut?.occurred_at ?? null,
    checkInLogId: isCheckIn ? log.id : null,
    checkOutLogId: checkOutLog?.id ?? fallbackCheckOut?.id ?? null,
    checkInAccuracyMeters: isCheckIn ? log.accuracy_meters : null,
    checkOutAccuracyMeters:
      checkOutLog?.accuracy_meters ?? fallbackCheckOut?.accuracy_meters ?? null,
    checkOutNotes: checkOutLog?.notes ?? fallbackCheckOut?.notes ?? null,
  };
}

type UseHistoryDataArgs = {
  userId: string | undefined;
};

export function useHistoryData({ userId }: UseHistoryDataArgs) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [rangeAnchor, setRangeAnchor] = useState(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now;
  });
  const [rows, setRows] = useState<DerivedLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const range = useMemo(
    () => getRange(rangeAnchor, rangeMode),
    [rangeAnchor, rangeMode],
  );
  const rangeLabel = useMemo(
    () => formatRangeLabel(range.start, range.end),
    [range.start, range.end],
  );

  const loadHistory = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }

    setIsLoading(true);

    try {
      const startIso = range.start.toISOString();
      const endIso = range.end.toISOString();

      const { data: logsData, error: logsError } = await supabase
        .from("attendance_logs")
        .select(
          "id, action, occurred_at, site_id, latitude, longitude, accuracy_meters, notes, sites(name)",
        )
        .eq("employee_id", userId)
        .gte("occurred_at", startIso)
        .lte("occurred_at", endIso)
        .order("occurred_at", { ascending: true });

      if (logsError) throw logsError;

      const logs = (logsData ?? []) as AttendanceLog[];
      const derived: HistoryDerivedLog[] = [];
      let openCheckIn: AttendanceLog | null = null;

      for (const log of logs) {
        if (log.action === "check_in") {
          if (openCheckIn) {
            derived.push(buildHistoryRow(openCheckIn, "Sin salida"));
          }

          openCheckIn = log;
          continue;
        }

        if (openCheckIn) {
          derived.push(buildHistoryRow(openCheckIn, "Turno cerrado", log));
          openCheckIn = null;
          continue;
        }

        derived.push(buildHistoryRow(log, "Sin entrada"));
      }

      if (openCheckIn) {
        derived.push(buildHistoryRow(openCheckIn, "En curso"));
      }

      setRows(derived.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)));
    } catch (err) {
      console.error("History error:", err);
      Alert.alert("Error", "No se pudo cargar el historial.");
    } finally {
      setIsLoading(false);
    }
  }, [range.end, range.start, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  }, [loadHistory]);

  const shiftRange = useCallback(
    (direction: "prev" | "next") => {
      setRangeAnchor((prev) => {
        const next = new Date(prev);
        if (rangeMode === "week") {
          next.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
        } else {
          next.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
        }
        return next;
      });
    },
    [rangeMode],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, DerivedLog[]>();
    rows.forEach((row) => {
      const list = map.get(row.dayKey) ?? [];
      list.push(row);
      map.set(row.dayKey, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [rows]);

  return {
    rangeMode,
    setRangeMode,
    rows,
    setRows,
    isLoading,
    isRefreshing,
    rangeLabel,
    grouped,
    handleRefresh,
    shiftRange,
  };
}
