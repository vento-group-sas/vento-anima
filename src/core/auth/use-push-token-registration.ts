import { useCallback, useEffect, useRef } from "react"
import { AppState } from "react-native"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { getOwnPushTokenStatus, syncNotificationPermissionState } from "@/core/notifications/push-token"

type PushTokenRegistrationArgs = {
  userId: string | null | undefined
  expoProjectId: string
}

export function usePushTokenRegistration({
  userId,
  expoProjectId,
}: PushTokenRegistrationArgs) {
  const pushSyncInFlightRef = useRef(false)
  const lastSuccessfulSyncAtRef = useRef(0)

  const syncPushToken = useCallback(async () => {
    if (!userId) return
    if (!Device.isDevice) return
    if (pushSyncInFlightRef.current) return

    pushSyncInFlightRef.current = true
    try {
      const permissions = await Notifications.getPermissionsAsync()
      if (permissions.status !== "granted") {
        const result = await syncNotificationPermissionState({ userId, expoProjectId })
        if (result.ok) {
          lastSuccessfulSyncAtRef.current = Date.now()
        } else {
          console.warn("[AUTH] Push permission sync incomplete:", result.message)
        }
        return
      }

      const status = await getOwnPushTokenStatus(userId)
      if (status.hasActiveToken && Date.now() - lastSuccessfulSyncAtRef.current < 6 * 60 * 60 * 1000) {
        return
      }

      const result = await syncNotificationPermissionState({ userId, expoProjectId })
      if (result.ok) {
        lastSuccessfulSyncAtRef.current = Date.now()
      } else {
        console.warn("[AUTH] Push token sync incomplete:", result.message)
      }
    } catch (err) {
      console.warn("[AUTH] Push token sync skipped:", err)
    } finally {
      pushSyncInFlightRef.current = false
    }
  }, [expoProjectId, userId])

  useEffect(() => {
    void syncPushToken()
  }, [syncPushToken])

  useEffect(() => {
    if (!userId) {
      lastSuccessfulSyncAtRef.current = 0
      return
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPushToken()
      }
    })

    return () => sub.remove()
  }, [syncPushToken, userId])
}
