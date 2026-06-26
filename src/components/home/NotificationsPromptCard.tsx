import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { PALETTE, RGBA } from "@/components/home/theme"

type NotificationsPromptCardProps = {
  isLoading: boolean
  mode?: "permission" | "token"
  onPress: () => void
}

export function NotificationsPromptCard({
  isLoading,
  mode = "permission",
  onPress,
}: NotificationsPromptCardProps) {
  const isTokenRepair = mode === "token"

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.85}
      style={{
        backgroundColor: "white",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: PALETTE.border,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: RGBA.washRoseGlow,
          borderWidth: 1,
          borderColor: RGBA.borderPink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="notifications-outline" size={22} color={PALETTE.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: PALETTE.text }}>
          {isTokenRepair ? "Repara las notificaciones" : "Activa las notificaciones"}
        </Text>
        <Text style={{ fontSize: 13, color: PALETTE.neutral, marginTop: 2 }}>
          {isTokenRepair
            ? "El permiso esta activo, falta registrar el token"
            : "Para recibir avisos de turnos y del equipo"}
        </Text>
      </View>
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: isLoading ? PALETTE.porcelain2 : RGBA.washRoseGlow,
          borderWidth: 1,
          borderColor: isLoading ? PALETTE.border : RGBA.borderPink,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            color: isLoading ? PALETTE.neutral : PALETTE.accent,
          }}
        >
          {isLoading ? "..." : isTokenRepair ? "Reparar" : "Activar"}
        </Text>
      </View>
    </TouchableOpacity>
  )
}
