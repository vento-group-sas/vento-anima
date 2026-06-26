import { Platform } from "react-native"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { supabase } from "@/lib/supabase"

const PUSH_TOKEN_MAX_ATTEMPTS = 3
const PUSH_TOKEN_TIMEOUT_MS = 10000

type RegisterPushTokenOptions = {
  userId: string
  expoProjectId: string
}

export type PushTokenSyncResult = {
  ok: boolean
  message: string
  token?: string
}

export type OwnPushTokenStatus = {
  hasActiveToken: boolean
  activeCount: number
  latestUpdatedAt: string | null
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timeout`)), ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

function getPlatformLabel() {
  return Platform.OS || Device.osName?.toLowerCase() || "unknown"
}

export async function getOwnPushTokenStatus(userId: string): Promise<OwnPushTokenStatus> {
  const { data, error } = await supabase
    .from("employee_push_tokens")
    .select("is_active, updated_at, created_at")
    .eq("employee_id", userId)
    .order("updated_at", { ascending: false })

  if (error) throw error

  const rows = data ?? []
  const activeRows = rows.filter((row) => row.is_active === true)
  const latest = rows[0] ?? null

  return {
    hasActiveToken: activeRows.length > 0,
    activeCount: activeRows.length,
    latestUpdatedAt: latest?.updated_at ?? latest?.created_at ?? null,
  }
}

export async function syncRegisteredPushToken({
  userId,
  expoProjectId,
}: RegisterPushTokenOptions): Promise<PushTokenSyncResult> {
  if (!userId) return { ok: false, message: "No hay sesion activa." }
  if (!Device.isDevice) {
    return { ok: false, message: "La validacion requiere un dispositivo fisico." }
  }

  const permissions = await Notifications.getPermissionsAsync()
  if (permissions.status !== "granted") {
    return { ok: false, message: "Las notificaciones no estan activas." }
  }

  let lastError = "No se pudo registrar el token de notificaciones."

  for (let attempt = 1; attempt <= PUSH_TOKEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const tokenResult = await withTimeout(
        Notifications.getExpoPushTokenAsync({ projectId: expoProjectId }),
        PUSH_TOKEN_TIMEOUT_MS,
        "getExpoPushTokenAsync",
      )
      const token = tokenResult.data?.trim()
      if (!token) {
        lastError = "El dispositivo no devolvio token."
        continue
      }

      const registerResult = await withTimeout(
        supabase.functions.invoke("register-push-token", {
          body: {
            token,
            platform: getPlatformLabel(),
          },
        }),
        PUSH_TOKEN_TIMEOUT_MS,
        "register-push-token",
      )
      const registerError = (registerResult as { error?: { message?: string } | null }).error
      if (registerError) {
        lastError = registerError.message || "Error guardando token en backend."
        continue
      }

      const verifyResult = await withTimeout(
        Promise.resolve(
          supabase
            .from("employee_push_tokens")
            .select("token, is_active")
            .eq("employee_id", userId)
            .eq("token", token)
            .maybeSingle(),
        ),
        PUSH_TOKEN_TIMEOUT_MS,
        "verify-token",
      )
      const { data, error } = verifyResult as {
        data?: { token?: string; is_active?: boolean } | null
        error?: { message?: string } | null
      }

      if (error) {
        lastError = error.message || "No se pudo verificar el token."
        continue
      }

      if (!data || data.is_active !== true) {
        lastError = "El token no quedo activo para este usuario."
        continue
      }

      return {
        ok: true,
        message: "Token registrado y verificado correctamente.",
        token,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Error inesperado registrando token."
    }

    if (attempt < PUSH_TOKEN_MAX_ATTEMPTS) {
      await wait(700 * attempt)
    }
  }

  return { ok: false, message: lastError }
}
