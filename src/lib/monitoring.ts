import * as Sentry from "@sentry/react-native"
import * as Updates from "expo-updates"

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
const monitoringEnabled = Boolean(sentryDsn)

if (monitoringEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    debug: __DEV__,
    environment: __DEV__ ? "development" : "production",
  })
}

if (monitoringEnabled) {
  const manifest = Updates.manifest
  const metadata = manifest && "metadata" in manifest ? (manifest as any).metadata : undefined
  const extra = manifest && "extra" in manifest ? (manifest as any).extra : undefined
  const updateGroup = metadata && "updateGroup" in metadata ? metadata.updateGroup : undefined
  const scope = Sentry.getGlobalScope()

  scope.setTag("expo-update-id", Updates.updateId ?? "unknown")
  scope.setTag("expo-is-embedded-update", String(Updates.isEmbeddedLaunch))

  if (typeof updateGroup === "string") {
    const owner = extra?.expoClient?.owner ?? "[account]"
    const slug = extra?.expoClient?.slug ?? "[project]"
    scope.setTag("expo-update-group-id", updateGroup)
    scope.setTag(
      "expo-update-debug-url",
      `https://expo.dev/accounts/${owner}/projects/${slug}/updates/${updateGroup}`,
    )
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled) {
    return
  }

  if (!context) {
    Sentry.captureException(error)
    return
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value as any)
    }

    Sentry.captureException(error)
  })
}

export function setMonitoringUser(user: { id?: string | null; email?: string | null } | null) {
  if (!monitoringEnabled) {
    return
  }

  if (!user?.id) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
  })
}
