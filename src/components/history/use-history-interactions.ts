import { useCallback, useState } from "react";
import { Alert } from "react-native";

import {
  createSupabaseAuthSessionUnavailableError,
  getSupabaseAuthSession,
  supabase,
} from "@/lib/supabase";
import type { DerivedLog } from "@/components/history/types";

type UseHistoryInteractionsArgs = {
  setRows: React.Dispatch<React.SetStateAction<DerivedLog[]>>;
};

export function useHistoryInteractions({
  setRows,
}: UseHistoryInteractionsArgs) {
  const [selectedLog, setSelectedLog] = useState<DerivedLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [isSavingIncident, setIsSavingIncident] = useState(false);

  const openDetails = useCallback((log: DerivedLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  }, []);

  const openIncident = useCallback((log: DerivedLog) => {
    setSelectedLog(log);
    setIncidentText(log.notes ?? "");
    setIsIncidentOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const closeIncident = useCallback(() => {
    setIsIncidentOpen(false);
  }, []);

   const saveIncident = useCallback(async () => {
    if (!selectedLog) return;

    const logId = selectedLog.id;
    const nextNotes = incidentText.trim() || null;

    setIsSavingIncident(true);

    try {
      const session = await getSupabaseAuthSession("attendance incident");
      if (!session?.user?.id) {
        throw createSupabaseAuthSessionUnavailableError("attendance incident");
      }

      const { data, error } = await supabase
        .from("attendance_logs")
        .update({ notes: nextNotes })
        .eq("id", logId)
        .select("id, notes")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          `No attendance_logs row was updated for incident log id: ${logId}`,
        );
      }

      const confirmedNotes = data.notes ?? null;

      setRows((prev) =>
        prev.map((item) =>
          item.id === logId ? { ...item, notes: confirmedNotes } : item,
        ),
      );

      setSelectedLog((prev) =>
        prev && prev.id === logId ? { ...prev, notes: confirmedNotes } : prev,
      );

      setIncidentText(confirmedNotes ?? "");
      setIsIncidentOpen(false);
    } catch (err) {
      console.error("Incident error:", err);
      Alert.alert(
        "No se pudo guardar",
        "La incidencia no quedó confirmada en la base de datos. Intenta de nuevo con conexión estable.",
      );
    } finally {
      setIsSavingIncident(false);
    }
  }, [incidentText, selectedLog, setRows]);

  return {
    selectedLog,
    isDetailOpen,
    isIncidentOpen,
    incidentText,
    setIncidentText,
    isSavingIncident,
    openDetails,
    openIncident,
    closeDetails,
    closeIncident,
    saveIncident,
  };
}
