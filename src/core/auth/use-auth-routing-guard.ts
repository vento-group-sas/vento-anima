import { useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

type RouterLike = {
  replace: (href: string) => void
}

type AuthRoutingGuardArgs = {
  user: User | null
  isLoading: boolean
  segments: string[]
  router: RouterLike
}

async function isEmployeeInactive(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("employees")
    .select("is_active")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.warn("[AUTH] Could not verify employee active status:", error)
    return false
  }

  return data?.is_active === false
}

export function useAuthRoutingGuard({
  user,
  isLoading,
  segments,
  router,
}: AuthRoutingGuardArgs) {
  const [routeBlocking, setRouteBlocking] = useState(true)
  const bootSplashShownRef = useRef(false)
  const inactiveSignOutInFlightRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const runGuard = async () => {
      const seg0 = segments[0] ?? ""
      const seg1 = segments[1] ?? ""

      const inAuthGroup = seg0 === "(auth)"
      const isSplashRoute = inAuthGroup && seg1 === "splash"

      if (isLoading) {
        if (!routeBlocking) setRouteBlocking(true)
        return
      }

      if (user?.id) {
        const inactive = await isEmployeeInactive(user.id)

        if (cancelled) return

        if (inactive) {
          setRouteBlocking(true)

          if (!inactiveSignOutInFlightRef.current) {
            inactiveSignOutInFlightRef.current = true
            try {
              await supabase.auth.signOut({ scope: "local" })
            } catch (err) {
              console.warn("[AUTH] Could not sign out inactive employee locally:", err)
            } finally {
              inactiveSignOutInFlightRef.current = false
            }
          }

          if (!cancelled && !isSplashRoute) {
            router.replace("/splash")
          }

          return
        }
      }

      if (!bootSplashShownRef.current) {
        bootSplashShownRef.current = true
        if (!isSplashRoute) {
          setRouteBlocking(true)
          router.replace("/splash")
          return
        }
        if (routeBlocking) setRouteBlocking(false)
        return
      }

      if (!user && !inAuthGroup) {
        setRouteBlocking(true)
        router.replace("/splash")
        return
      }

      if (user && inAuthGroup && !isSplashRoute) {
        setRouteBlocking(true)
        router.replace("/home")
        return
      }

      if (routeBlocking) setRouteBlocking(false)
    }

    void runGuard()

    return () => {
      cancelled = true
    }
  }, [user?.id, isLoading, segments, router, routeBlocking])

  useEffect(() => {
    if (!routeBlocking || isLoading) return
    const timer = setTimeout(() => {
      setRouteBlocking(false)
    }, 12000)
    return () => clearTimeout(timer)
  }, [routeBlocking, isLoading])

  return routeBlocking
}
