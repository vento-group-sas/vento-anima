import "@/lib/monitoring"
import "@/hooks/attendance/background-location-task"

import { useEffect, useRef } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AuthProvider } from "@/contexts/auth-context"
import { AppConfigProvider } from "@/contexts/app-config-context"
import { AttendanceProvider } from "@/contexts/attendance-context"
import { AppUpdateGate } from "@/components/AppUpdateGate"
import { useAppUpdatePolicy } from "@/hooks/use-app-update-policy"
import { reportError } from "@/lib/monitoring"
import { getAnimaAppUpdateKey } from "@/brand/anima/config/runtime"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

type LayoutErrorBoundaryProps = {
  error: Error
  retry: () => void
}

export function ErrorBoundary({ error, retry }: LayoutErrorBoundaryProps) {
  const reportedErrorRef = useRef<Error | null>(null)

  useEffect(() => {
    if (reportedErrorRef.current === error) {
      return
    }
    reportedErrorRef.current = error
    reportError(error, { screen: "root_layout_error_boundary" })
  }, [error])

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Ocurrio un error inesperado</Text>
      <Text style={styles.errorText}>{error?.message ?? "Sin detalles"}</Text>
      <TouchableOpacity style={styles.errorButton} onPress={retry}>
        <Text style={styles.errorButtonText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function RootLayout() {
  const configuredAppUpdateKey = Constants.expoConfig?.extra?.appUpdateKey as string | undefined
  const fallbackAppUpdateKey = getAnimaAppUpdateKey(__DEV__)
  const appUpdateKey = configuredAppUpdateKey ?? fallbackAppUpdateKey
  const { updateInfo, openStore, dismissOptionalUpdate } = useAppUpdatePolicy(appUpdateKey)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppConfigProvider>
          <AttendanceProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ animation: "none" }} />
              <Stack.Screen name="(auth)" options={{ animation: "none" }} />
              <Stack.Screen name="(app)" />
            </Stack>
            <AppUpdateGate
              updateInfo={updateInfo}
              onUpdatePress={() => {
                void openStore()
              }}
              onDismissOptional={dismissOptionalUpdate}
            />
          </AttendanceProvider>
          </AppConfigProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F7F5F8",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  errorButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
})
