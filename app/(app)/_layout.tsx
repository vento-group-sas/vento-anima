import { useEffect } from "react"
import { Tabs, useRouter } from "expo-router"
import * as Notifications from "expo-notifications"
import { Ionicons } from "@expo/vector-icons"
import { Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { COLORS } from "@/constants/colors"
import { useAuth } from "@/contexts/auth-context"
import { useSupportUnreadCount } from "@/components/support/use-support-unread-count"

export default function AppLayout() {
  const { user, employee } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const role = employee?.role ?? null
  const supportUnreadCount = useSupportUnreadCount(user?.id)

  useEffect(() => {
    const openShiftScreenIfNeeded = (data: Record<string, unknown> | undefined) => {
      if (
        data?.type === "shift_update" ||
        data?.type === "shift" ||
        data?.type === "shift_end_reminder" ||
        data?.type === "shift_auto_checkout"
      ) {
        router.replace("/shifts")
        return
      }
      if (data?.type === "support_message") {
        router.replace("/support")
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined
      openShiftScreenIfNeeded(data)
    })

    const sub = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data as Record<string, unknown> | undefined
      openShiftScreenIfNeeded(data)
    })
    return () => sub.remove()
  }, [router])
  const canSeeTeam =
    role === "propietario" || role === "gerente_general" || role === "gerente"
  const canSeeResumen =
    role === "propietario" || role === "gerente_general" || role === "gerente"
  const androidBottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 16) : 0
  const iosBottomInset = Platform.OS === "ios" ? Math.max(insets.bottom, 12) : 0

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,

        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.neutral,

        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
        },

        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,

          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? iosBottomInset : androidBottomInset,
          height: Platform.OS === "ios" ? 64 + iosBottomInset : 56 + androidBottomInset,

          // iOS shadow
          shadowColor: COLORS.shadow ?? COLORS.text,
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },

          // Android elevation
          elevation: 12,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Check-in",
          tabBarLabel: "Check-in",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "location" : "location-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="shifts"
        options={{
          title: "Turnos",
          tabBarLabel: "Turnos",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "Historial",
          tabBarLabel: "Historial",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="documents"
        options={{
          title: "Documentos",
          tabBarLabel: "Documentos",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="carnet"
        options={{
          title: "Carnet",
          tabBarLabel: "Carnet",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "id-card" : "id-card-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="announcements"
        options={{
          title: "Novedades",
          tabBarLabel: "Novedades",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="operativo"
        options={{
          title: "Resumen",
          tabBarLabel: "Resumen",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "stats-chart" : "stats-chart-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
          ...(canSeeResumen ? {} : { href: null }),
        }}
      />


      <Tabs.Screen
        name="team"
        options={{
          title: "Equipo",
          tabBarLabel: "Equipo",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
          ...(canSeeTeam
            ? {}
            : {
                href: null,
              }),
        }}
      />

      <Tabs.Screen
        name="support"
        options={{
          title: "Soporte",
          tabBarLabel: "Soporte",
          tabBarBadge: supportUnreadCount > 0 ? supportUnreadCount : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "help-circle" : "help-circle-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}




