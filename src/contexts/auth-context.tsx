import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  StyleSheet,
  View,
} from "react-native"
import { useRouter, useSegments } from "expo-router"
import type { Session, User } from "@supabase/supabase-js"

import { clearAuthCache, getAuthCacheKey, writeAuthCache } from "@/core/auth/cache"
import { AUTH_LOAD_TIMEOUT_MS, loadEmployeeBundle as loadAuthEmployeeBundle } from "@/core/auth/employee-bundle"
import { attachAuthSessionBootstrap } from "@/core/auth/session-bootstrap"
import { signInWithRateLimit } from "@/core/auth/sign-in"
import type { AuthContextType, Employee, EmployeeSite } from "@/core/auth/types"
import { useAuthRoutingGuard } from "@/core/auth/use-auth-routing-guard"
import { useEmployeeSitesSubscription } from "@/core/auth/use-employee-sites-subscription"
import { useMonitoringUserSync } from "@/core/auth/use-monitoring-user-sync"
import { usePushTokenRegistration } from "@/core/auth/use-push-token-registration"
import { ANIMA_RUNTIME } from "@/brand/anima/config/runtime"
import { supabase } from "@/lib/supabase"

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const EXPO_PROJECT_ID = ANIMA_RUNTIME.expoProjectId

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [employeeSites, setEmployeeSites] = useState<EmployeeSite[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [hasPendingSiteChanges, setHasPendingSiteChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const lastSessionRef = useRef<Session | null>(null)
  const router = useRouter()
  const segments = useSegments() as unknown as string[]
  // Splash al volver desde background si estuvo inactiva más de X tiempo
  const INACTIVITY_MS = 15 * 60 * 1000 // 15 minutos

  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const lastBackgroundAtRef = useRef<number | null>(null)
  const pendingResumeSplashRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)
  const signInInFlightRef = useRef(false)
  const signInLastAttemptAtRef = useRef(0)
  const signInLastEmailRef = useRef<string | null>(null)
  const signInCooldownUntilRef = useRef(0)
  const employeeBundleLoadRef = useRef<{
    userId: string
    promise: Promise<void>
  } | null>(null)

  // Guardamos la ruta actual para poder consultarla dentro del listener de AppState
  const segmentsRef = useRef<string[]>(segments)
  // ✅ Mantener segmentsRef en sync (evita redirects basados en rutas viejas)
  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  useMonitoringUserSync(user)

  const routeBlocking = useAuthRoutingGuard({
    user,
    isLoading,
    segments,
    router,
  })

  useEmployeeSitesSubscription({
    userId: user?.id,
    onPendingChange: () => {
      setHasPendingSiteChanges(true)
    },
  })

  usePushTokenRegistration({
    userId: user?.id,
    expoProjectId: EXPO_PROJECT_ID,
  })

  const resetAuthState = () => {
    setSession(null)
    setUser(null)
    setEmployee(null)
    setEmployeeSites([])
    setSelectedSiteId(null)
    setHasPendingSiteChanges(false)
    lastUserIdRef.current = null
  }

  const clearInvalidSession = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch (err) {
      console.warn("[AUTH] Local signOut failed while clearing invalid session:", err)
    } finally {
      resetAuthState()
      lastSessionRef.current = null
    }
  }

  const clearEmployeeState = useCallback(() => {
    setEmployee(null)
    setEmployeeSites([])
    setSelectedSiteId(null)
    lastUserIdRef.current = null
  }, [])

  const resetForUser = (userId: string) => {
    if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
      setEmployee(null)
      setEmployeeSites([])
      setSelectedSiteId(null)
    }
    lastUserIdRef.current = userId
  }

  const loadEmployeeBundle = async (userId: string) => {
    resetForUser(userId)

    const inFlight = employeeBundleLoadRef.current
    if (inFlight?.userId === userId) {
      await inFlight.promise
      return
    }

    const promise = loadAuthEmployeeBundle(userId, {
      setEmployee,
      setEmployeeSites,
      setSelectedSiteId,
    }, AUTH_LOAD_TIMEOUT_MS)

    employeeBundleLoadRef.current = { userId, promise }

    try {
      await promise
    } finally {
      if (employeeBundleLoadRef.current?.promise === promise) {
        employeeBundleLoadRef.current = null
      }
    }
  }

  const setSelectedSite = useCallback(async (siteId: string | null) => {
    if (!user) return
    setSelectedSiteId(siteId)

    const { error } = await supabase.from("employee_settings").upsert(
      {
        employee_id: user.id,
        selected_site_id: siteId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id" }
    )

    if (error) {
      console.error("Error updating selected site:", error)
      return
    }

    await writeAuthCache(getAuthCacheKey(user.id, "settings"), {
      selected_site_id: siteId,
    })
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    if (!selectedSiteId) return
    if (employeeSites.length === 0) return
    const exists = employeeSites.some((site) => site.siteId === selectedSiteId)
    if (exists) return
    void setSelectedSite(null)
  }, [user?.id, selectedSiteId, employeeSites, setSelectedSite])

  useEffect(() => {
    if (user?.id) return
    setHasPendingSiteChanges(false)
  }, [user?.id])

  useEffect(() => {
    return attachAuthSessionBootstrap({
      lastSessionRef,
      setSession,
      setUser,
      setEmployee,
      setEmployeeSites,
      setSelectedSiteId,
      setIsLoading,
      clearInvalidSession,
      resetAuthState,
      clearEmployeeState,
      loadEmployeeBundle,
    })
  }, [clearEmployeeState])

  useEffect(() => {
    if (session) lastSessionRef.current = session
  }, [session])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current
      appStateRef.current = nextState

      // Cuando se va a background/inactive, marcamos timestamp
      if (prevState === "active" && (nextState === "background" || nextState === "inactive")) {
        lastBackgroundAtRef.current = Date.now()
        return
      }

      // Cuando vuelve a active, evaluamos inactividad
      if ((prevState === "background" || prevState === "inactive") && nextState === "active") {
        const last = lastBackgroundAtRef.current
        lastBackgroundAtRef.current = null

        if (!last) return

        const inactiveFor = Date.now() - last
        if (inactiveFor < INACTIVITY_MS) return

        // Si todavía está cargando auth, lo dejamos pendiente
        if (isLoading) {
          pendingResumeSplashRef.current = true
          return
        }

        const seg0 = segmentsRef.current?.[0] ?? ""
        const seg1 = segmentsRef.current?.[1] ?? ""
        const inAuthGroup = seg0 === "(auth)"
        const isSplashRoute = inAuthGroup && seg1 === "splash"

        if (!isSplashRoute) {
          router.replace("/splash")
        }
      }
    })

    return () => {
      sub.remove()
    }
  }, [router, isLoading])

  useEffect(() => {
    if (isLoading) return
    if (!pendingResumeSplashRef.current) return

    pendingResumeSplashRef.current = false

    const seg0 = segmentsRef.current?.[0] ?? ""
    const seg1 = segmentsRef.current?.[1] ?? ""
    const inAuthGroup = seg0 === "(auth)"
    const isSplashRoute = inAuthGroup && seg1 === "splash"

    if (!isSplashRoute) {
      router.replace("/splash")
    }
  }, [isLoading, router])

  const signIn = async (email: string, password: string) => {
    await signInWithRateLimit(
      email,
      password,
      {
        signInInFlightRef,
        signInLastAttemptAtRef,
        signInLastEmailRef,
        signInCooldownUntilRef,
      },
      ({ email: normalizedEmail, password: nextPassword }) =>
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: nextPassword,
        }),
    )
  }

  const signOut = async () => {
    const userId = user?.id ?? null

    resetAuthState()
    lastSessionRef.current = null
    setIsLoading(false)

    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch (err) {
      console.warn("[AUTH] Local signOut failed:", err)
    }

    if (userId) {
      try {
        await clearAuthCache(userId)
      } catch (err) {
        console.warn("[AUTH] Auth cache clear failed:", err)
      }
    }
  }

  const refreshEmployee = async () => {
    if (user) {
      await loadEmployeeBundle(user.id)
      setHasPendingSiteChanges(false)
    }
  }

  const consumePendingSiteChanges = useCallback(() => {
    setHasPendingSiteChanges(false)
  }, [])

  const isSplashSegment = segments.includes("splash")

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        employee,
        employeeSites,
        selectedSiteId,
        hasPendingSiteChanges,
        isLoading,
        signIn,
        signOut,
        refreshEmployee,
        consumePendingSiteChanges,
        setSelectedSite,
      }}
    >
      {children}

      {routeBlocking && !isSplashSegment ? (
        <View style={styles.routeBlocker} pointerEvents="auto">
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de AuthProvider")
  }
  return context
}
const styles = StyleSheet.create({
  routeBlocker: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
})
