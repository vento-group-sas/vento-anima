import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"

import { PALETTE, RGBA } from "@/components/home/theme"

type AttendanceActionCardProps = {
  cardStyle: object
  cardTintStyle: object
  canRegister: boolean
  isGeofenceBlocked: boolean
  isLoading: boolean
  isGeoChecking: boolean
  isCheckActionLocked: boolean
  ctaTextColor: string
  ctaPrimaryLabel: string
  ctaSecondaryLabel: string | null
  onCheck: () => void
  onRevalidateBlockedLocation: () => void
}

export function AttendanceActionCard({
  cardStyle,
  cardTintStyle,
  canRegister,
  isGeofenceBlocked,
  isLoading,
  isGeoChecking,
  isCheckActionLocked,
  ctaTextColor,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  onCheck,
  onRevalidateBlockedLocation,
}: AttendanceActionCardProps) {
  // El CTA bloqueado solo actualiza GPS: nunca ejecuta check-in/check-out.
  const canRevalidateBlockedLocation =
    isGeofenceBlocked && !canRegister && !isLoading && !isGeoChecking && !isCheckActionLocked
  const canPress = canRegister || canRevalidateBlockedLocation
  const actionTextColor = canRevalidateBlockedLocation ? PALETTE.white : ctaTextColor

  return (
    <View style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
      <View pointerEvents="none" style={cardTintStyle} />
      <TouchableOpacity
        onPress={canRevalidateBlockedLocation ? onRevalidateBlockedLocation : onCheck}
        disabled={!canPress}
        style={[
          {
            borderRadius: 20,
            paddingVertical: 18,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canPress ? PALETTE.accent : RGBA.ctaDisabled,
            borderWidth: canPress ? 0 : 1,
            borderColor: canPress ? "transparent" : PALETTE.border,
            shadowColor: canPress ? PALETTE.accent : "transparent",
            shadowOpacity: canPress ? 0.3 : 0,
            shadowRadius: canPress ? 12 : 0,
            shadowOffset: { width: 0, height: 6 },
            elevation: canPress ? 6 : 0,
            minHeight: 64,
          },
        ]}
        activeOpacity={0.85}
      >
        {isLoading || isGeoChecking || isCheckActionLocked ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={actionTextColor} size="small" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: actionTextColor,
                letterSpacing: 0.3,
              }}
            >
              {ctaPrimaryLabel}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: actionTextColor,
                opacity: canPress ? 0.95 : 0.6,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {ctaPrimaryLabel}
            </Text>

            {ctaSecondaryLabel ? (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: actionTextColor,
                  letterSpacing: 0.2,
                }}
              >
                {ctaSecondaryLabel}
              </Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}
