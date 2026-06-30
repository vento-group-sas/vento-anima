import { useState } from "react";
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
import {
  CONTENT_HORIZONTAL_PADDING,
  CONTENT_MAX_WIDTH,
} from "@/constants/layout";
import ContactWorkerModal, { type WorkerOption } from "@/components/support/ContactWorkerModal";
import { SupportFaqSection } from "@/components/support/SupportFaqSection";
import { SupportHeroCard } from "@/components/support/SupportHeroCard";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import { SupportTicketsSection } from "@/components/support/SupportTicketsSection";
import { useSupportActions } from "@/components/support/use-support-actions";
import { useSupportData } from "@/components/support/use-support-data";
import { SUPPORT_UI } from "@/components/support/ui";
import { ANIMA_COPY } from "@/brand/anima/copy/app-copy";
import { useAuth } from "@/contexts/auth-context";
import type { FaqItem, TicketStatus } from "@/components/support/types";

const UI = SUPPORT_UI;

const FAQ_ITEMS: FaqItem[] = [
  {
    key: "checkin",
    label: "No puedo hacer check-in",
    icon: "location-outline",
    content: [
      "Verifica que tengas internet estable y vuelve a actualizar la ubicación desde Home.",
      "Confirma que estás dentro del radio permitido de la sede y con precisión GPS suficiente.",
      "Si sigue fallando, crea un ticket con captura del mensaje y hora del intento.",
    ],
  },
  {
    key: "site",
    label: "Cómo actualizar mi sede",
    icon: "business-outline",
    content: [
      "La sede principal la gestiona un gerente, gerente general o propietario desde Equipo.",
      "Si trabajas en varias sedes, selecciona la sede correcta antes del check-in.",
      "Después del cambio, refresca Home para recargar permisos y geocerca.",
    ],
  },
  {
    key: "gps",
    label: "Error en la ubicación GPS",
    icon: "navigate-outline",
    content: [
      "Activa GPS de alta precisión y evita registrar asistencia en interiores sin señal.",
      "Desactiva apps de ubicación simulada o modo desarrollador con mock location.",
      "Si Android no muestra el permiso en app, ve a Ajustes del sistema y habilítalo manualmente.",
    ],
  },
  {
    key: "android-permissions",
    label: "Cómo activar permisos en Android",
    icon: "phone-portrait-outline",
    content: [...ANIMA_COPY.supportAndroidPermissionsFaq],
  },
  {
    key: "week-view",
    label: "Cómo ver mi semana de turnos",
    icon: "calendar-outline",
    content: [
      "En la pestaña Turnos puedes revisar tu semana completa de lunes a domingo.",
      "Si tienes más de un turno el mismo día, aparecerán como bloques separados.",
      "Si eres gerente o superior, también verás la semana general de la sede.",
    ],
  },
  {
    key: "export-role",
    label: "Cómo exportar asistencia por rol",
    icon: "download-outline",
    content: [
      "Trabajadores y roles no gerenciales exportan solo su registro personal.",
      "Gerentes exportan asistencia global de su sede seleccionada.",
      "Propietario y gerente general pueden exportar global o por trabajador individual.",
    ],
  },
];

function statusMeta(status: TicketStatus) {
  if (status === "open") {
    return { label: "Abierto", color: COLORS.accent, bg: "rgba(226, 0, 106, 0.10)" };
  }
  if (status === "in_progress") {
    return { label: "En progreso", color: "#B45309", bg: "#FFFBEB" };
  }
  if (status === "resolved") {
    return { label: "Resuelto", color: "#0F766E", bg: "#ECFEFF" };
  }
  return { label: "Cerrado", color: COLORS.neutral, bg: COLORS.porcelainAlt };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MANAGEMENT_ROLES = new Set(["propietario", "gerente_general", "gerente"]);

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, selectedSiteId } = useAuth();
  const role = employee?.role ?? null;
  const canContactWorker = Boolean(role && MANAGEMENT_ROLES.has(role));
  const managerSiteId = role === "gerente" ? (employee?.siteId ?? selectedSiteId ?? null) : null;
  const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const {
    workersForContact,
    isLoadingWorkers,
    tickets,
    isLoadingTickets,
    isRefreshing,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    messages,
    isLoadingMessages,
    loadTickets,
    loadMessages,
    handleRefresh,
  } = useSupportData({
    userId: user?.id,
    canContactWorker,
    role,
    managerSiteId,
    contactModalVisible,
  });
  const {
    isTicketOpen,
    setIsTicketOpen,
    ticketTitle,
    setTicketTitle,
    ticketMessage,
    setTicketMessage,
    isCreatingTicket,
    contactMode,
    setContactMode,
    selectedWorker,
    setSelectedWorker,
    contactMessage,
    setContactMessage,
    isSubmittingContact,
    newMessage,
    setNewMessage,
    isSendingMessage,
    ticketActionInFlightId,
    submitTicket,
    sendMessage,
    closeTicket,
    hideTicket,
    submitContactWorker,
  } = useSupportActions({
    userId: user?.id,
    employeeSiteId: employee?.siteId,
    selectedSiteId: selectedSiteId ?? null,
    selectedTicketId,
    loadTickets,
    loadMessages,
    setSelectedTicketId,
  });
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
        <SupportHeroCard
          canContactWorker={canContactWorker}
          ticketCount={tickets.length}
          hasSelectedTicket={Boolean(selectedTicket)}
          onCreateTicket={() => setIsTicketOpen(true)}
          onSendNotice={() => {
            setContactMode("aviso");
            setSelectedWorker(null);
            setContactMessage("");
            setContactModalVisible(true);
          }}
          onStartConversation={() => {
            setContactMode("conversacion");
            setSelectedWorker(null);
            setContactMessage("");
            setContactModalVisible(true);
          }}
        />

        <View style={{ marginTop: 18, gap: 12 }}>
          <SupportTicketsSection
            tickets={tickets}
            isLoadingTickets={isLoadingTickets}
            selectedTicketId={selectedTicketId}
            selectedTicket={selectedTicket}
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            newMessage={newMessage}
            isSendingMessage={isSendingMessage}
            ticketActionInFlightId={ticketActionInFlightId}
            onSelectTicket={setSelectedTicketId}
            onChangeNewMessage={setNewMessage}
            onSendMessage={sendMessage}
            onCloseTicket={closeTicket}
            onHideTicket={hideTicket}
            formatDateTime={formatDateTime}
            statusMeta={statusMeta}
            currentUserId={user?.id}
          />

          <SupportFaqSection
            items={FAQ_ITEMS}
            openFaqKey={openFaqKey}
            onToggle={(key) => setOpenFaqKey(openFaqKey === key ? null : key)}
          />
        </View>
      </ScrollView>

      <SupportTicketModal
        visible={isTicketOpen}
        title={ticketTitle}
        message={ticketMessage}
        isSubmitting={isCreatingTicket}
        onChangeTitle={setTicketTitle}
        onChangeMessage={setTicketMessage}
        onClose={() => setIsTicketOpen(false)}
        onSubmit={submitTicket}
      />

      <ContactWorkerModal
        visible={contactModalVisible}
        workers={workersForContact}
        isLoadingWorkers={isLoadingWorkers}
        selectedWorker={selectedWorker}
        onSelectWorker={setSelectedWorker}
        onClose={() => {
          setContactModalVisible(false);
          setSelectedWorker(null);
          setContactMessage("");
        }}
        mode={contactMode}
        message={contactMessage}
        onChangeMessage={setContactMessage}
        isSubmitting={isSubmittingContact}
        onSubmit={submitContactWorker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
});
