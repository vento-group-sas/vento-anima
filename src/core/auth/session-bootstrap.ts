import type { Session, User } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

type SessionBootstrapArgs = {
  lastSessionRef: React.MutableRefObject<Session | null>
  setSession: React.Dispatch<React.SetStateAction<Session | null>>
  setUser: React.Dispatch<React.SetStateAction<User | null>>
  setEmployee: React.Dispatch<React.SetStateAction<any>>
  setEmployeeSites: React.Dispatch<React.SetStateAction<any[]>>
  setSelectedSiteId: React.Dispatch<React.SetStateAction<string | null>>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  clearInvalidSession: () => Promise<void>
  resetAuthState: () => void
  clearEmployeeState: () => void
  loadEmployeeBundle: (userId: string) => Promise<void>
}

export function attachAuthSessionBootstrap({
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
}: SessionBootstrapArgs) {
  let isActive = true

  void supabase.auth.getSession().then(async ({ data: { session }, error }) => {
    if (!isActive) return

    setIsLoading(true)

    try {
      if (error) {
        console.warn("[AUTH] getSession error:", error)
        const message = String((error as any)?.message ?? "").toLowerCase()
        const isInvalidRefreshToken = message.includes("invalid refresh token")
        if (isInvalidRefreshToken) {
          await clearInvalidSession()
          return
        }

        const fallback = lastSessionRef.current
        if (fallback) {
          setSession(fallback)
          setUser(fallback.user ?? null)
        } else {
          resetAuthState()
        }
        return
      }

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadEmployeeBundle(session.user.id)
      } else {
        clearEmployeeState()
        setEmployee(null)
        setEmployeeSites([])
        setSelectedSiteId(null)
      }
    } finally {
      if (isActive) setIsLoading(false)
    }
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
    setIsLoading(true)

    try {
      if ((event as string) === "TOKEN_REFRESH_FAILED") {
        console.warn("[AUTH] Token refresh failed, keeping last session")
        await clearInvalidSession()
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        await loadEmployeeBundle(nextSession.user.id)
      } else {
        clearEmployeeState()
        setEmployee(null)
        setEmployeeSites([])
        setSelectedSiteId(null)
      }
    } finally {
      setIsLoading(false)
    }
  })

  return () => {
    isActive = false
    subscription.unsubscribe()
  }
}
