import { useCallback, useMemo, useState } from "react";
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
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useAppPermissions } from "@/hooks/use-app-permissions";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { DocumentAlertsCard } from "@/components/documents/DocumentAlertsCard";
import { DocumentsEmptyState } from "@/components/documents/DocumentsEmptyState";
import { DocumentsEmployeeFilterCard } from "@/components/documents/DocumentsEmployeeFilterCard";
import { DocumentsHeroCard } from "@/components/documents/DocumentsHeroCard";
import { UploadDocumentModal } from "@/components/documents/UploadDocumentModal";
import { DocumentPickerModal } from "@/components/documents/DocumentPickerModal";
import { useDocumentsData } from "@/components/documents/use-documents-data";
import { useDocumentNotifications } from "@/components/documents/use-document-notifications";
import { useDocumentUpload } from "@/components/documents/use-document-upload";
import {
  addMonthsSafe,
  diffDays,
  formatDateOnly,
  formatShortDate,
  parseDateOnly,
} from "@/components/documents/date-utils";
import { DOCUMENTS_UI } from "@/components/documents/ui";
import type {
  DocumentRow,
} from "@/components/documents/types";

// Filtros de estado eliminados - solo gerentes suben documentos, no hay necesidad de estados
const UI = DOCUMENTS_UI;
const DEFAULT_REMINDER_DAYS = 7;
const DOCUMENT_PERMISSION_CODES = [
  "anima.documents.view_all",
  "anima.documents.upload",
  "anima.documents.delete",
];

// Funciones de estado eliminadas - no se usan más

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, employeeSites, selectedSiteId } = useAuth();
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null);
  const { has: hasPermission, loaded: permissionsLoaded } = useAppPermissions(DOCUMENT_PERMISSION_CODES);

  const roleCanManageScopes = useMemo(() => {
    const role = employee?.role ?? null;
    return role === "propietario" || role === "gerente_general" || role === "gerente";
  }, [employee?.role]);
  const roleCanViewAllSites = useMemo(() => {
    const role = employee?.role ?? null;
    return role === "propietario" || role === "gerente_general";
  }, [employee?.role]);
  const canManageScopes = permissionsLoaded
    ? hasPermission("anima.documents.upload") || roleCanManageScopes
    : roleCanManageScopes;
  const canDeleteDocuments = permissionsLoaded
    ? hasPermission("anima.documents.delete") || roleCanManageScopes
    : roleCanManageScopes;
  const canViewAllSites = permissionsLoaded
    ? hasPermission("anima.documents.view_all") || roleCanViewAllSites
    : roleCanViewAllSites;
  const isManager = useMemo(() => employee?.role === "gerente", [employee?.role]);

  const managerSiteId = useMemo(() => {
    if (isManager && employee?.siteId) return employee.siteId;
    return null;
  }, [isManager, employee?.siteId]);
  const {
    documents,
    setDocuments,
    documentTypes,
    sites,
    availableEmployees,
    isLoading,
    isRefreshing,
    loadDocuments,
    loadDocumentTypes,
    loadAvailableEmployees,
    handleRefresh,
  } = useDocumentsData({
    userId: user?.id,
    canManageScopes,
    canViewAllSites,
    isManager,
    employeeSiteId: employee?.siteId,
    employeeSiteName: employee?.siteName,
    managerSiteId,
    employeeSites,
    filterEmployeeId,
  });
  const {
    notificationsEnabled,
    isScheduling,
    pushTokenReady,
    alertDocuments,
  } = useDocumentNotifications({
    userId: user?.id,
    documents,
  });
  const {
    isUploadOpen,
    selectedFile,
    description,
    setDescription,
    customTitle,
    setCustomTitle,
    scope,
    setScope,
    siteId,
    setSiteId,
    selectedTypeId,
    setSelectedTypeId,
    issueDate,
    setIssueDate,
    expiryDate,
    setExpiryDate,
    showIssuePicker,
    setShowIssuePicker,
    showExpiryPicker,
    setShowExpiryPicker,
    tempIssueDate,
    setTempIssueDate,
    tempExpiryDate,
    setTempExpiryDate,
    isExpiryManual,
    setIsExpiryManual,
    activePicker,
    setActivePicker,
    pickerQuery,
    setPickerQuery,
    isSaving,
    selectedEmployeeId,
    setSelectedEmployeeId,
    filteredTypes,
    filteredSites,
    filteredEmployees,
    selectedEmployee,
    selectedType,
    activeSiteId,
    pickDocument,
    closeUploadModal,
    openUpload,
    handleSaveDocument,
  } = useDocumentUpload({
    userId: user?.id,
    employeeId: employee?.id,
    canManageScopes,
    selectedSiteId: selectedSiteId ?? null,
    documentTypes,
    sites,
    availableEmployees,
    loadDocuments,
  });

  const openDocument = async (row: DocumentRow) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(row.storage_path, 60 * 5);

      if (error) throw error;
      if (!data?.signedUrl) {
        throw new Error("No se pudo generar un enlace seguro para este documento.");
      }

      await Linking.openURL(data.signedUrl);
    } catch (err) {
      console.error("[DOCUMENTS] Open document error:", err);
      Alert.alert(
        "Documento",
        `No se pudo abrir el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    }
  };

  const handleDeleteDocument = async (doc: DocumentRow) => {
    Alert.alert(
      "Eliminar documento",
      `¿Estás seguro de que quieres eliminar "${doc.document_type?.name ?? doc.title}"? Esta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Eliminar inmediatamente de la UI para feedback rápido
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
              
              // Primero eliminar el registro de la base de datos (más importante)
              const { error: deleteError } = await supabase
                .from("documents")
                .delete()
                .eq("id", doc.id);

              if (deleteError) {
                console.error("[DOCUMENTS] Error deleting document from DB:", deleteError);
                // Revertir el cambio en la UI si falla
                await loadDocuments();
                throw deleteError;
              }

              // Luego intentar eliminar el archivo del storage
              const { error: storageError } = await supabase.storage
                .from("documents")
                .remove([doc.storage_path]);

              if (storageError) {
                console.warn("[DOCUMENTS] Error deleting file from storage (non-critical):", storageError);
                // No lanzar error, el documento ya fue eliminado de la BD
              }

              // Recargar la lista de documentos para asegurar sincronización
              await loadDocuments();
              
              Alert.alert("Documento", "Documento eliminado correctamente.");
            } catch (err) {
              console.error("[DOCUMENTS] Error deleting document:", err);
              // Recargar para restaurar el estado correcto
              await loadDocuments();
              Alert.alert(
                "Error", 
                `No se pudo eliminar el documento: ${err instanceof Error ? err.message : 'Error desconocido'}`
              );
            }
          },
        },
      ]
    );
  };

  // Métricas de estado eliminadas - no se necesitan

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
        <DocumentsHeroCard
          canManageScopes={canManageScopes}
          totalDocuments={documents.length}
          alertCount={alertDocuments.length}
          onUpload={openUpload}
        />

        <DocumentAlertsCard
          notificationsEnabled={notificationsEnabled}
          isScheduling={isScheduling}
          items={alertDocuments.map(({ doc, daysLeft }) => ({
            id: doc.id,
            title: doc.document_type?.name ?? doc.title,
            label:
              daysLeft < 0
                ? `Vencido hace ${Math.abs(daysLeft)} días`
                : daysLeft === 0
                  ? "Vence hoy"
                  : `Vence en ${daysLeft} días`,
            tone: daysLeft < 0 ? COLORS.neutral : COLORS.accent,
          }))}
        />

        {canManageScopes ? (
          <DocumentsEmployeeFilterCard
            filterEmployeeId={filterEmployeeId}
            availableEmployees={availableEmployees}
            onOpen={async () => {
              if (availableEmployees.length === 0) {
                await loadAvailableEmployees()
              }
              setPickerQuery("")
              setActivePicker("employee")
            }}
            onClear={() => setFilterEmployeeId(null)}
          />
        ) : null}

        {isLoading ? (
          <View style={{ paddingTop: 30, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}

        {documents.length === 0 && !isLoading ? (
          <View style={{ marginTop: 18 }}>
            <DocumentsEmptyState canManageScopes={canManageScopes} onUpload={openUpload} />
          </View>
        ) : null}

        <View style={{ marginTop: 18, gap: 12 }}>
          {documents.map((doc) => {
            const today = parseDateOnly(formatDateOnly(new Date()))
            const expiry = doc.expiry_date ? parseDateOnly(doc.expiry_date) : null
            const daysLeft = expiry ? diffDays(expiry, today) : null
            const reminderDays =
              doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS
            let expiryLabel: string | null = null
            let expiryTone: string = COLORS.neutral
            if (daysLeft !== null) {
              if (daysLeft < 0) {
                expiryLabel = `Vencido hace ${Math.abs(daysLeft)} días`
                expiryTone = COLORS.neutral
              } else if (daysLeft === 0) {
                expiryLabel = "Vence hoy"
                expiryTone = COLORS.accent
              } else if (daysLeft <= reminderDays) {
                expiryLabel = `Vence en ${daysLeft} días`
                expiryTone = COLORS.accent
              }
            }
            return (
              <DocumentCard
                key={doc.id}
                title={doc.document_type?.name ?? doc.title}
                fileName={doc.file_name}
                expiryDateLabel={formatShortDate(doc.expiry_date)}
                scopeLabel={
                  doc.scope === "employee" ? "Personal" : doc.scope === "site" ? "Sede" : "Grupo"
                }
                expiryLabel={expiryLabel}
                expiryTone={expiryTone}
                onOpen={() => openDocument(doc)}
                showDelete={canDeleteDocuments}
                onDelete={() => handleDeleteDocument(doc)}
              />
            );
          })}
        </View>
      </ScrollView>

      {canManageScopes ? (
        <UploadDocumentModal
          visible={isUploadOpen}
          insets={insets}
          styles={styles}
          onClose={closeUploadModal}
          onSave={handleSaveDocument}
          isSaving={isSaving}
          scope={scope}
          setScope={setScope}
          canManageScopes={canManageScopes}
          availableEmployees={availableEmployees}
          loadAvailableEmployees={loadAvailableEmployees}
          selectedEmployee={selectedEmployee}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          documentTypes={documentTypes}
          loadDocumentTypes={loadDocumentTypes}
          selectedType={selectedType}
          selectedTypeId={selectedTypeId}
          setSelectedTypeId={setSelectedTypeId}
          selectedFile={selectedFile}
          pickDocument={pickDocument}
          description={description}
          setDescription={setDescription}
          customTitle={customTitle}
          setCustomTitle={setCustomTitle}
          activeSiteId={activeSiteId}
          sites={sites}
          setSiteId={setSiteId}
          issueDate={issueDate}
          setIssueDate={setIssueDate}
          expiryDate={expiryDate}
          setExpiryDate={setExpiryDate}
          showIssuePicker={showIssuePicker}
          setShowIssuePicker={setShowIssuePicker}
          showExpiryPicker={showExpiryPicker}
          setShowExpiryPicker={setShowExpiryPicker}
          tempIssueDate={tempIssueDate}
          setTempIssueDate={setTempIssueDate}
          tempExpiryDate={tempExpiryDate}
          setTempExpiryDate={setTempExpiryDate}
          isExpiryManual={isExpiryManual}
          setIsExpiryManual={setIsExpiryManual}
          activePicker={activePicker}
          setActivePicker={setActivePicker}
          pickerQuery={pickerQuery}
          setPickerQuery={setPickerQuery}
          filteredTypes={filteredTypes}
          filteredEmployees={filteredEmployees}
          filteredSites={filteredSites}
          addMonthsSafe={addMonthsSafe}
          formatDateOnly={formatDateOnly}
          formatShortDate={formatShortDate}
        />
      ) : null}

      <DocumentPickerModal
        visible={activePicker !== null && !isUploadOpen}
        insets={insets}
        styles={styles}
        pickerQuery={pickerQuery}
        setPickerQuery={setPickerQuery}
        availableEmployees={availableEmployees}
        filteredEmployees={filteredEmployees}
        filterEmployeeId={filterEmployeeId}
        setFilterEmployeeId={setFilterEmployeeId}
        onClose={() => setActivePicker(null)}
        onRetryEmployees={loadAvailableEmployees}
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
  metricCard: {
    flex: 1,
    padding: 12,
    alignItems: "flex-start",
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.neutral,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 6,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  alertSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.neutral,
  },
  alertRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alertRowTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },
  alertRowMeta: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.accent,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  docMeta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
  },
  modalLabel: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 12,
  },
  modalHint: {
    fontSize: 11,
    color: COLORS.neutral,
    marginTop: 6,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.porcelain,
    paddingTop: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerBack: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  pickerSearchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerSearchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
    color: COLORS.text,
  },
  pickerList: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  pickerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 14,
  },
  pickerItemActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  pickerItemHint: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.neutral,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    marginTop: 12,
    color: COLORS.text,
  },
});
