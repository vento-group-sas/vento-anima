import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, Linking } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { ANIMA_COPY } from "@/brand/anima/copy/app-copy"
import { getOwnPushTokenStatus, syncRegisteredPushToken } from "@/core/notifications/push-token"

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unknown"

type UseHomeNotificationsArgs = {
  userId: string | null | undefined
  authIsLoading: boolean
  initialLoadDone: boolean
  dependencyKey: string
  expoProjectId: string
  enabled?: boolean
}

function mapPermissionStatus(status: Notifications.PermissionStatus): NotificationPermissionStatus {
  if (status === "granted") return "granted"
  if (status === "denied") return "denied"
  if (status === "undetermined") return "undetermined"
  return "unknown"
}

export function useHomeNotifications({
  userId,
  authIsLoading,
  initialLoadDone,
  dependencyKey,
  expoProjectId,
  enabled = true,
}: UseHomeNotificationsArgs) {
  const notificationsPromptAttemptedForUserRef = useRef<string | null>(null)
  const notificationsPromptInFlightRef = useRef(false)
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<NotificationPermissionStatus>("unknown")
  const [notificationPromptLoading, setNotificationPromptLoading] = useState(false)
  const [hasActivePushToken, setHasActivePushToken] = useState<boolean | null>(null)

  const refreshPushTokenStatus = useCallback(async () => {
    if (!userId) {
      setHasActivePushToken(null)
      return
    }
    try {
      const status = await getOwnPushTokenStatus(userId)
      setHasActivePushToken(status.hasActiveToken)
    } catch (err) {
      console.warn("[HOME] Push token status failed:", err)
      setHasActivePushToken(null)
    }
  }, [userId])

  const syncPushToken = useCallback(async () => {
    if (!userId || !Device.isDevice) return false
    const result = await syncRegisteredPushToken({ userId, expoProjectId })
    if (!result.ok) {
      console.warn("[HOME] Push token sync failed:", result.message)
    }
    await refreshPushTokenStatus()
    return result.ok
  }, [expoProjectId, refreshPushTokenStatus, userId])

  const refreshNotificationPermission = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync()
      const status = mapPermissionStatus(perm.status)
      setNotificationPermissionStatus(status)
      if (status === "granted") {
        await refreshPushTokenStatus()
      } else {
        setHasActivePushToken(null)
      }
    } catch {
      setNotificationPermissionStatus("unknown")
      setHasActivePushToken(null)
    }
  }, [refreshPushTokenStatus])

  useFocusEffect(
    useCallback(() => {
      if (enabled) {
        void refreshNotificationPermission()
      }
    }, [enabled, refreshNotificationPermission]),
  )

  const requestNotificationPermissionOrOpenSettings = useCallback(async () => {
    setNotificationPromptLoading(true)
    try {
      const current = await Notifications.getPermissionsAsync()
      const status = mapPermissionStatus(current.status)
      const canAsk = typeof current.canAskAgain === "boolean" ? current.canAskAgain : null

      if (status === "granted") {
        const synced = await syncPushToken()
        await refreshNotificationPermission()
        if (!synced) {
          Alert.alert(
            "Token pendiente",
            "Las notificaciones estan activas, pero falta guardar el token. Reintenta con buena conexion.",
          )
        }
        return
      }

      if (status === "denied" && canAsk === false) {
        Alert.alert(
          ANIMA_COPY.notificationsBlockedTitle,
          ANIMA_COPY.notificationsBlockedBody,
          [
            { text: "Cerrar", style: "cancel" },
            { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
          ],
        )
        await refreshNotificationPermission()
        return
      }

      const { status: asked } = await Notifications.requestPermissionsAsync()
      await refreshNotificationPermission()
      if (asked === "granted") {
        const synced = await syncPushToken()
        Alert.alert(
          synced ? "Listo" : "Token pendiente",
          synced
            ? ANIMA_COPY.notificationsEnabledBody
            : "El permiso quedo activo, pero falta guardar el token. Toca Reparar notificaciones en unos segundos.",
        )
      } else if (asked === "denied") {
        const again = await Notifications.getPermissionsAsync()
        const canAskAgain = typeof again.canAskAgain === "boolean" ? again.canAskAgain : null
        if (canAskAgain === false) {
          Alert.alert(
            "Notificaciones desactivadas",
            "Para recibir avisos activa las notificaciones en Ajustes.",
            [
              { text: "Cerrar", style: "cancel" },
              { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
            ],
          )
        }
      }
    } catch (err) {
      console.warn("[HOME] Notification permission request failed:", err)
      Alert.alert("Error", "No se pudo solicitar el permiso. Prueba desde Ajustes de la app.")
    } finally {
      setNotificationPromptLoading(false)
    }
  }, [refreshNotificationPermission, syncPushToken])

  useEffect(() => {
    if (!userId) {
      notificationsPromptAttemptedForUserRef.current = null
      notificationsPromptInFlightRef.current = false
      return
    }
    if (!enabled) return
    if (authIsLoading) return
    if (!initialLoadDone) return
    if (notificationsPromptAttemptedForUserRef.current === userId) return
    if (notificationsPromptInFlightRef.current) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || notificationsPromptInFlightRef.current) return
        notificationsPromptInFlightRef.current = true
        try {
          const permissions = await Notifications.getPermissionsAsync()
          if (permissions.status === "granted") {
            const status = await getOwnPushTokenStatus(userId)
            if (!status.hasActiveToken) {
              await syncPushToken()
            }
            return
          }
          if (permissions.status === "undetermined") {
            const asked = await Notifications.requestPermissionsAsync()
            if (asked.status === "granted") {
              await syncPushToken()
            }
          }
        } catch (err) {
          console.warn("[HOME] Notification permission flow skipped:", err)
        } finally {
          notificationsPromptInFlightRef.current = false
          if (!cancelled) {
            notificationsPromptAttemptedForUserRef.current = userId
          }
        }
      })()
    }, 1200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [userId, authIsLoading, initialLoadDone, dependencyKey, enabled, syncPushToken])

  return {
    notificationPermissionStatus,
    notificationPromptLoading,
    hasActivePushToken,
    requestNotificationPermissionOrOpenSettings,
  }
}
