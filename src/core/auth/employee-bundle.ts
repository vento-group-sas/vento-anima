import { getAuthCacheKey, readAuthCache, writeAuthCache } from "@/core/auth/cache"
import type { Employee, EmployeeSite } from "@/core/auth/types"
import { supabase } from "@/lib/supabase"

export const AUTH_LOAD_TIMEOUT_MS = 8000

type EmployeeBundleSetters = {
  setEmployee: React.Dispatch<React.SetStateAction<Employee | null>>
  setEmployeeSites: React.Dispatch<React.SetStateAction<EmployeeSite[]>>
  setSelectedSiteId: React.Dispatch<React.SetStateAction<string | null>>
}

async function loadEmployee(userId: string, setters: EmployeeBundleSetters) {
  const { setEmployee } = setters

  try {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        id,
        full_name,
        alias,
        role,
        site_id,
        photo_url,
        is_active,
        sites:sites!employees_site_id_fkey (name)
      `,
      )
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[AUTH] Error loading employee:", error)
      console.error("[AUTH] Error details:", JSON.stringify(error, null, 2))
      return
    }

    if (!data) {
      console.error("[AUTH] No employee data returned for user:", userId)
      setEmployee(null)
      return
    }

    const nextEmployee: Employee = {
      id: data.id,
      fullName: data.full_name,
      alias: data.alias,
      role: data.role,
      siteId: data.site_id,
      siteName: (data.sites as any)?.name || null,
      avatarUrl: data.photo_url ?? null,
      isActive: data.is_active,
    }
    setEmployee(nextEmployee)
    await writeAuthCache(getAuthCacheKey(userId, "employee"), nextEmployee)
  } catch (err) {
    console.error("[AUTH] Exception loading employee:", err)
  }
}

async function loadEmployeeSites(userId: string, setters: EmployeeBundleSetters) {
  const { setEmployeeSites } = setters

  try {
    const { data, error } = await supabase
      .from("employee_sites")
      .select(
        `
        site_id,
        is_primary,
        is_active,
        sites:sites!employee_sites_site_id_fkey (
          id,
          name,
          latitude,
          longitude,
          checkin_radius_meters,
          type,
          site_type
        )
      `,
      )
      .eq("employee_id", userId)

    if (error) {
      console.error("[AUTH] Error loading employee sites:", error)
      console.error("[AUTH] Error details:", JSON.stringify(error, null, 2))
      return
    }

    if (!data) {
      console.warn("[AUTH] No employee sites data returned for user:", userId)
      setEmployeeSites([])
      return
    }

    const activeRows = (data ?? []).filter((row: any) => row?.is_active !== false)

    const nextSites = activeRows
      .map((row) => {
        const site = row.sites as any
        if (!site) return null
        return {
          siteId: row.site_id,
          siteName: site.name,
          latitude: site.latitude ?? null,
          longitude: site.longitude ?? null,
          radiusMeters: site.checkin_radius_meters ?? null,
          type: site.type ?? null,
          siteType: site.site_type ?? null,
          isPrimary: row.is_primary ?? false,
        } as EmployeeSite
      })
      .filter(Boolean) as EmployeeSite[]

    setEmployeeSites(nextSites)
    await writeAuthCache(getAuthCacheKey(userId, "sites"), nextSites)
  } catch (err) {
    console.error("[AUTH] Exception loading employee sites:", err)
  }
}

async function loadEmployeeSettings(userId: string, setters: EmployeeBundleSetters) {
  const { setSelectedSiteId } = setters

  try {
    const { data, error } = await supabase
      .from("employee_settings")
      .select("selected_site_id")
      .eq("employee_id", userId)
      .maybeSingle()

    if (error) {
      console.error("[AUTH] Error loading employee settings:", error)
      return
    }

    const nextSelected = data?.selected_site_id ?? null
    setSelectedSiteId(nextSelected)
    await writeAuthCache(getAuthCacheKey(userId, "settings"), {
      selected_site_id: nextSelected,
    })
  } catch (err) {
    console.error("[AUTH] Exception loading employee settings:", err)
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[AUTH] Timeout while loading ${label}`)
      resolve(null)
    }, ms)

    promise
      .then((value) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((err) => {
        if (timeoutId) clearTimeout(timeoutId)
        console.error(`[AUTH] Error loading ${label}:`, err)
        resolve(null)
      })
  })
}

export async function hydrateEmployeeBundleFromCache(
  userId: string,
  setters: EmployeeBundleSetters,
) {
  const { setEmployee, setEmployeeSites, setSelectedSiteId } = setters

  const [cachedEmployee, cachedSites, cachedSettings] = await Promise.all([
    readAuthCache<Employee>(getAuthCacheKey(userId, "employee")),
    readAuthCache<EmployeeSite[]>(getAuthCacheKey(userId, "sites")),
    readAuthCache<{ selected_site_id: string | null }>(getAuthCacheKey(userId, "settings")),
  ])

  if (cachedEmployee && cachedEmployee.id === userId) {
    setEmployee((prev) => prev ?? cachedEmployee)
  }

  if (cachedSites && cachedSites.length) {
    setEmployeeSites((prev) => (prev.length ? prev : cachedSites))
  }

  if (cachedSettings && cachedSettings.selected_site_id !== undefined) {
    setSelectedSiteId((prev) => (prev === null ? cachedSettings.selected_site_id : prev))
  }
}

export async function loadEmployeeBundle(
  userId: string,
  setters: EmployeeBundleSetters,
  timeoutMs = AUTH_LOAD_TIMEOUT_MS,
) {
  await hydrateEmployeeBundleFromCache(userId, setters)
  await Promise.all([
    withTimeout(loadEmployee(userId, setters), timeoutMs, "employee"),
    withTimeout(loadEmployeeSites(userId, setters), timeoutMs, "employee_sites"),
    withTimeout(loadEmployeeSettings(userId, setters), timeoutMs, "employee_settings"),
  ])
}
