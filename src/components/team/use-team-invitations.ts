import { useCallback, useRef, useState } from "react";

import { Alert } from "react-native";

import { ANIMA_COPY } from "@/brand/anima/copy/app-copy";
import { supabase } from "@/lib/supabase";
import { getUserFacingAuthError } from "@/utils/error-messages";
import type { InviteFormState, SiteRow } from "@/components/team/types";
import type { StaffInvitationRow } from "@/components/team/use-team-data";

type UseTeamInvitationsArgs = {
  canManageTeam: boolean;
  canAssignRole: (targetRole: string) => boolean;
  isManager: boolean;
  managerSiteId: string | null;
  selectedSiteId: string | null;
  employeeSiteId: string | null | undefined;
  sites: SiteRow[];
  loadInvitations: (opts?: { force?: boolean }) => Promise<void>;
};

function parseInvitationExpirationDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function useTeamInvitations({
  canManageTeam,
  canAssignRole,
  isManager,
  managerSiteId,
  selectedSiteId,
  employeeSiteId,
  sites,
  loadInvitations,
}: UseTeamInvitationsArgs) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    email: "",
    fullName: "",
    role: "",
    siteId: null,
    expiresAt: "",
  });
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);
  const inviteInFlightRef = useRef(false);
  const activeInvitationActionsRef = useRef(new Set<string>());

  const updateInviteForm = useCallback((patch: Partial<InviteFormState>) => {
    setInviteForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const getInviteErrorMessage = useCallback((error: unknown, fallback: string) => {
    const parsed =
      error && typeof error === "object"
        ? (error as { message?: string; context?: unknown; details?: string })
        : {};

    const context = typeof parsed.context === "string" ? parsed.context : "";
    const details = typeof parsed.details === "string" ? parsed.details : "";
    const raw = [parsed.message, context, details]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ");

    const normalized = raw.toLowerCase();
    if (
      normalized.includes("forbidden role") ||
      normalized.includes("forbidden site") ||
      normalized.includes("invalid role") ||
      normalized.includes("invalid site")
    ) {
      return "La invitación no es válida para el rol o la sede seleccionada.";
    }
    if (
      normalized.includes("already registered") ||
      normalized.includes("duplicate") ||
      normalized.includes("ya est")
    ) {
      return "Ese correo ya tiene una cuenta o una invitacion pendiente. Revisa la lista de invitaciones: si aparece pendiente, usa Reenviar; si ya tiene cuenta, el trabajador puede recuperar contrasena desde el login.";
    }
    if (normalized.includes("resend already in progress") || normalized.includes("resend in progress")) {
      return "El reenvío ya está en curso. Actualiza la lista cuando termine.";
    }
    if (normalized.includes("changed during") || normalized.includes("cannot be resent")) {
      return "La invitación cambió de estado. Actualiza la lista antes de intentarlo de nuevo.";
    }
    if (normalized.includes("invitation cancelled") || normalized.includes("already accepted")) {
      return "Esta invitación fue cancelada o aceptada. Actualiza la lista.";
    }
    if (normalized.includes("no se pudo enviar el correo")) {
      return "No se pudo enviar el correo de invitación.";
    }
    if (
      normalized.includes("resend_api_key") ||
      normalized.includes("set_password_web_url") ||
      normalized.includes("redirect_url")
    ) {
      return "Falta configuración de invitaciones en el backend.";
    }

    return getUserFacingAuthError(error, raw || fallback);
  }, []);

  const openInvite = useCallback(() => {
    if (!canManageTeam) return;
    const defaultSite = isManager
      ? managerSiteId
      : selectedSiteId ?? employeeSiteId ?? sites[0]?.id ?? null;
    if (isManager && !defaultSite) {
      Alert.alert("Equipo", "No tienes una sede asignada.");
      return;
    }
    setInviteForm({
      email: "",
      fullName: "",
      role: "",
      siteId: defaultSite,
      expiresAt: "",
    });
    setInviteEmailSent(null);
    setInviteSuccessMessage(null);
    setIsInviteOpen(true);
  }, [canManageTeam, employeeSiteId, isManager, managerSiteId, selectedSiteId, sites]);

  const closeInvite = useCallback(() => {
    setIsInviteOpen(false);
    setInviteEmailSent(null);
    setInviteSuccessMessage(null);
  }, []);

  const readFunctionError = useCallback(async (error: unknown) => {
    const context = (error as { context?: unknown } | null)?.context;
    if (context && typeof (context as Response).clone === "function") {
      try {
        const payload = await (context as Response).clone().json();
        const message = [payload?.error, payload?.message, payload?.details]
          .filter((value) => typeof value === "string" && value.trim())
          .join(" ");
        if (message) return message;
      } catch {
        // Some function errors do not include a JSON body.
      }
    }
    return null;
  }, []);

  const handleInvite = useCallback(async () => {
    if (!canManageTeam || inviteInFlightRef.current) return;
    if (!inviteForm.email.trim()) {
      Alert.alert("Equipo", "Escribe el correo del trabajador.");
      return;
    }
    if (!inviteForm.role) {
      Alert.alert("Equipo", "Selecciona un rol.");
      return;
    }
    if (!canAssignRole(inviteForm.role)) {
      Alert.alert("Equipo", "No tienes permisos para asignar ese rol.");
      return;
    }
    if (!inviteForm.siteId) {
      Alert.alert("Equipo", "Selecciona una sede principal.");
      return;
    }
    if (isManager && managerSiteId && inviteForm.siteId !== managerSiteId) {
      Alert.alert("Equipo", "Solo puedes invitar a tu sede.");
      return;
    }

    inviteInFlightRef.current = true;
    setIsInviting(true);
    try {
      const body: {
        email: string;
        full_name: string | null;
        role: string;
        site_id: string;
        expires_at?: string;
      } = {
        email: inviteForm.email.trim(),
        full_name: inviteForm.fullName.trim() || null,
        role: inviteForm.role,
        site_id: inviteForm.siteId,
      };
      const expiresAtTrim = inviteForm.expiresAt?.trim();
      if (expiresAtTrim) {
        const date = parseInvitationExpirationDay(expiresAtTrim);
        if (!date || date.getTime() <= Date.now()) {
          Alert.alert("Equipo", "Fecha de vencimiento inválida. Usa AAAA-MM-DD y selecciona hoy o una fecha posterior.");
          return;
        }
        body.expires_at = date.toISOString();
      }

      const { data, error } = await supabase.functions.invoke(
        "staff-invitations-create",
        { body },
      );

      if (error) {
        const functionMessage = await readFunctionError(error);
        Alert.alert(
          "Equipo",
          getInviteErrorMessage(
            functionMessage ? { message: functionMessage } : error,
            "No se pudo procesar la invitación. Intenta nuevamente.",
          ),
        );
        return;
      }
      if ((data as { error?: string; details?: string })?.error) {
        const payload = data as { error?: string; details?: string };
        Alert.alert(
          "Equipo",
          getInviteErrorMessage(
            {
              message: payload.error,
              details: payload.details,
            },
            "No se pudo procesar la invitación. Intenta nuevamente.",
          ),
        );
        return;
      }
      if (!data?.invited && !(data as { added_to_team?: boolean })?.added_to_team) {
        Alert.alert("Equipo", "No se pudo enviar la invitación.");
        return;
      }

      setInviteEmailSent(inviteForm.email.trim());
      setInviteSuccessMessage(
        (data as { message?: string })?.message ?? null,
      );
      await loadInvitations({ force: true });
    } catch (err) {
      console.error("Invite error:", err);
      Alert.alert(
        "Equipo",
        getInviteErrorMessage(
          err,
          "No se pudo procesar la invitación. Intenta nuevamente.",
        ),
      );
    } finally {
      inviteInFlightRef.current = false;
      setIsInviting(false);
    }
  }, [canAssignRole, canManageTeam, getInviteErrorMessage, inviteForm, isManager, loadInvitations, managerSiteId, readFunctionError]);

  const getEffectiveInvitationStatus = useCallback((invitation: StaffInvitationRow) => {
    if (
      invitation.status === "sent" &&
      invitation.expires_at &&
      new Date(invitation.expires_at).getTime() < Date.now()
    ) {
      return "expired";
    }
    return invitation.status;
  }, []);

  const getInvitationStatusLabel = useCallback((status: string) => {
    if (status === "sent") return "Pendiente";
    if (status === "expired") return "Vencida";
    if (status === "linked_existing_user") return "Agregado al equipo";
    if (status === "cancelled") return "Cancelada";
    return status;
  }, []);

  const formatInvitationDate = useCallback((value: string | null) => {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const handleResendInvitation = useCallback(
    async (invitation: StaffInvitationRow) => {
      if (!canManageTeam || activeInvitationActionsRef.current.has(invitation.id)) return;
      if (getEffectiveInvitationStatus(invitation) === "linked_existing_user") {
        Alert.alert("Equipo", ANIMA_COPY.teamExistingUserNeedsPasswordBody);
        return;
      }
      activeInvitationActionsRef.current.add(invitation.id);
      setResendingInvitationId(invitation.id);
      try {
        const { data, error } = await supabase.functions.invoke(
          "staff-invitations-resend", { body: { staff_invitation_id: invitation.id } },
        );
        if (error) {
          const detail = await readFunctionError(error);
          Alert.alert("Equipo", getInviteErrorMessage(
            detail ? { message: detail } : error,
            "No se pudo reenviar la invitación. Intenta nuevamente.",
          ));
          return;
        }
        const response = data as {
          ok?: boolean; status?: string; invitation_id?: string;
          error?: string; message?: string;
        } | null;
        if (response?.error || response?.ok !== true ||
            response?.status !== "sent" || response?.invitation_id !== invitation.id) {
          Alert.alert("Equipo", getInviteErrorMessage(
            { message: response?.error || "El servidor no confirmó el reenvío." },
            "No se pudo reenviar la invitación.",
          ));
          return;
        }
        Alert.alert("Equipo", response.message || "Invitación reenviada correctamente.");
        await loadInvitations({ force: true });
      } catch (err) {
        console.error("Resend invitation error:", err);
        Alert.alert("Equipo", getInviteErrorMessage(
          err, "No se pudo reenviar la invitación. Intenta nuevamente.",
        ));
      } finally {
        activeInvitationActionsRef.current.delete(invitation.id);
        setResendingInvitationId(null);
      }
    },
    [canManageTeam, getEffectiveInvitationStatus, getInviteErrorMessage, loadInvitations, readFunctionError],
  );

  const handleCancelInvitation = useCallback(
    async (invitation: StaffInvitationRow) => {
      if (!canManageTeam || activeInvitationActionsRef.current.has(invitation.id)) return;
      Alert.alert(
        "Cancelar invitación",
        `Se cancelará la invitación de ${invitation.email ?? "este correo"}.`,
        [
          { text: "Cerrar", style: "cancel" },
          {
            text: "Cancelar invitación",
            style: "destructive",
            onPress: async () => {
              if (activeInvitationActionsRef.current.has(invitation.id)) return;
              activeInvitationActionsRef.current.add(invitation.id);
              setCancellingInvitationId(invitation.id);
              try {
                const { data, error } = await supabase.functions.invoke(
                  "staff-invitations-cancel", { body: { staff_invitation_id: invitation.id } },
                );
                if (error) {
                  const detail = await readFunctionError(error);
                  Alert.alert("Equipo", getInviteErrorMessage(
                    detail ? { message: detail } : error,
                    "No se pudo cancelar la invitación.",
                  ));
                  return;
                }
                const response = data as {
                  ok?: boolean; status?: string; invitation_id?: string;
                  error?: string; message?: string;
                } | null;
                if (response?.error || response?.ok !== true ||
                    response?.status !== "cancelled" || response?.invitation_id !== invitation.id) {
                  Alert.alert("Equipo", getInviteErrorMessage(
                    { message: response?.error || "El servidor no confirmó la cancelación." },
                    "No se pudo cancelar la invitación.",
                  ));
                  return;
                }
                Alert.alert("Equipo", response.message || "Invitación cancelada correctamente.");
                await loadInvitations({ force: true });
              } catch (err) {
                console.error("Cancel invitation error:", err);
                Alert.alert("Equipo", getInviteErrorMessage(
                  err, "No se pudo cancelar la invitación.",
                ));
              } finally {
                activeInvitationActionsRef.current.delete(invitation.id);
                setCancellingInvitationId(null);
              }
            },
          },
        ],
      );
    },
    [canManageTeam, getInviteErrorMessage, loadInvitations, readFunctionError],
  );

  return {
    isInviteOpen,
    isInviting,
    inviteEmailSent,
    inviteSuccessMessage,
    inviteForm,
    resendingInvitationId,
    cancellingInvitationId,
    updateInviteForm,
    openInvite,
    closeInvite,
    handleInvite,
    getEffectiveInvitationStatus,
    getInvitationStatusLabel,
    formatInvitationDate,
    handleResendInvitation,
    handleCancelInvitation,
  };
}
