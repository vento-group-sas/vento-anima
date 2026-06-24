import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { HISTORY_UI } from "@/components/history/ui";
import type { DerivedLog } from "@/components/history/types";

type HistoryDetailModalProps = {
  visible: boolean;
  log: DerivedLog | null;
  onClose: () => void;
  formatHour: (value: string) => string;
  formatDuration: (minutes: number | null) => string;
  getSiteName: (
    sites: { name: string | null } | { name: string | null }[] | null,
  ) => string | null;
};

type HistoryDetailLog = DerivedLog & {
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInAccuracyMeters?: number | null;
  checkOutAccuracyMeters?: number | null;
  checkOutNotes?: string | null;
};

function getCheckInAt(log: HistoryDetailLog) {
  if (log.checkInAt) return log.checkInAt;
  return log.action === "check_in" ? log.occurred_at : null;
}

function getCheckOutAt(log: HistoryDetailLog) {
  if (log.checkOutAt) return log.checkOutAt;
  return log.action === "check_out" ? log.occurred_at : null;
}

function formatOptionalHour(
  value: string | null,
  formatHour: (value: string) => string,
) {
  if (!value) return "--";
  return formatHour(value);
}

function getLocationLabel(log: HistoryDetailLog) {
  const hasMainCoordinates = log.latitude != null && log.longitude != null;
  const hasCheckInAccuracy = log.checkInAccuracyMeters != null;
  const hasCheckOutAccuracy = log.checkOutAccuracyMeters != null;

  if (hasMainCoordinates || hasCheckInAccuracy || hasCheckOutAccuracy) {
    return "Registrada";
  }

  return "No registrada";
}

function getIncidentText(log: HistoryDetailLog) {
  const checkOutNotes = log.checkOutNotes?.trim();
  if (checkOutNotes) return checkOutNotes;

  const notes = log.notes?.trim();
  if (notes) return notes;

  return "Sin incidencia registrada";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function HistoryDetailModal({
  visible,
  log,
  onClose,
  formatHour,
  getSiteName,
}: HistoryDetailModalProps) {
  const detailLog = log as HistoryDetailLog | null;
  const checkInAt = detailLog ? getCheckInAt(detailLog) : null;
  const checkOutAt = detailLog ? getCheckOutAt(detailLog) : null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.modalCard}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="time-outline" size={18} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Detalle del turno</Text>
              <Text style={styles.modalSubtitle}>Registro de asistencia</Text>
            </View>
          </View>

          {detailLog ? (
            <View style={styles.content}>
              <View style={styles.timeGrid}>
                <View style={styles.timeBox}>
                  <View style={styles.timeBoxHeader}>
                    <Ionicons name="log-in-outline" size={16} color={COLORS.accent} />
                    <Text style={styles.timeLabel}>Entrada</Text>
                  </View>
                  <Text style={styles.timeValue}>
                    {formatOptionalHour(checkInAt, formatHour)}
                  </Text>
                </View>

                <View style={styles.timeBox}>
                  <View style={styles.timeBoxHeader}>
                    <Ionicons name="log-out-outline" size={16} color={COLORS.rosegold} />
                    <Text style={styles.timeLabel}>Salida</Text>
                  </View>
                  <Text style={styles.timeValue}>
                    {formatOptionalHour(checkOutAt, formatHour)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <DetailRow
                  label="Sede"
                  value={getSiteName(detailLog.sites) ?? "Sin sede"}
                />
                <DetailRow label="Estado" value={detailLog.statusLabel} />
                <DetailRow label="Ubicación" value={getLocationLabel(detailLog)} />
                <DetailRow label="Incidencia" value={getIncidentText(detailLog)} />
              </View>
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                HISTORY_UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  minWidth: 104,
                },
              ]}
            >
              <Text style={styles.cancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.18)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 3,
  },
  content: {
    marginTop: 16,
  },
  timeGrid: {
    flexDirection: "row",
    gap: 10,
  },
  timeBox: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.porcelainAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.neutral,
  },
  timeValue: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    fontVariant: ["tabular-nums"],
  },
  detailCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.neutral,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 19,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancelText: {
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
});
