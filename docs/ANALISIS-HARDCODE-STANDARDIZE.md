# Análisis: valores hardcodeados y estandarización (BD como fuente de verdad)

**Schema revisado:** `vento-shell/supabase/schema.sql` (volcado desde remoto).  
Objetivo: una sola fuente de verdad en la base de datos para poder escalar y quitar literales del código.

---

## Estado actual del schema (resumen)

- **Enums:** `document_scope`, `document_status`, `permission_scope_type`, `recipe_status`, `site_type`, `support_ticket_status`.
- **Tablas de catálogo:** `roles`, `role_site_type_rules`, `sites`, `document_types`, `apps`, `app_permissions`, `role_permissions`, `employee_permissions`.
- **No existen aún:** `app_config` / `tenant_settings`, `announcements`, `attendance_policy`, `role_capabilities` (o capacidades en `roles`), `site_type_config` (requires_geofence).

---

## 1. Roles y capacidades

**En BD hoy:** `roles` (code, name, description, is_active), `role_site_type_rules` (qué rol en qué site_type), `role_permissions` (permisos por rol con scope).

**Hardcodeado en schema y código:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| **Funciones SQL** | `is_owner()` → `= 'propietario'`; `is_global_manager()` → `= 'gerente_general'`; `is_manager()` → `= 'gerente'`; `is_manager_or_owner()` → `in ('propietario','gerente','gerente_general')` | RLS y lógica de negocio |
| **can_access_recipe_scope** | `'gerente'`, `'bodeguero'` | Acceso a recetas |
| **RLS (schema)** | `'gerente'`, `'propietario'`, `'gerente_general'`, `'bodeguero'`, `'cajero'`, `'barista'`, `'cocinero'`, `'panadero'`, `'repostero'`, `'pastelero'` en policies de: areas, attendance_logs, document_types, documents, employee_shifts, employee_sites, employees, production_batches, restock_requests, support_tickets, pos_sessions, etc. | Quién puede SELECT/INSERT/UPDATE/DELETE |
| **App ANIMA** | _layout.tsx, team.tsx, documents.tsx, home.tsx: mismos códigos de rol | Pestaña Equipo, documentos, reportes |
| **Edge Functions** | staff-invitations-create, attendance-report: OWNER_ROLE, MANAGER_ROLE, ALLOWED_GLOBAL_ROLES, etc. | Invitar, reporte global |
| **SQL scripts** | create_test_account, check_allowed_roles: lista completa de roles en CASE | Cuenta de prueba, diagnóstico |

**Problema:** Añadir un rol o una “capacidad” (ej. “puede gestionar equipo”) obliga a tocar funciones, RLS y app.

**Propuesta (BD como fuente de verdad):**

1. **Tabla `role_capabilities`** (o columnas en `roles`):
   - `role_code` (FK a `roles.code`), `capability` (text o enum), ej.: `can_manage_team`, `can_upload_documents`, `can_view_global_reports`, `can_manage_support_tickets`, `can_edit_employees`, `is_owner`, `is_global_manager`, `is_manager`.
   - Poblar desde los roles actuales según la lógica actual (propietario/gerente_general/gerente con la mayoría de capacidades).
2. **Función `employee_has_capability(p_employee_id uuid, p_capability text) returns boolean`** que consulte `employees.role` + `role_capabilities`.
3. **Reemplazar en RLS** todas las condiciones tipo `current_employee_role() = 'gerente'` por `employee_has_capability(auth.uid(), 'can_...')`.
4. **Reemplazar** `is_owner()`, `is_global_manager()`, `is_manager()`, `is_manager_or_owner()` por llamadas a `employee_has_capability(auth.uid(), 'is_owner')` etc., o mantener esas funciones pero que internamente lean de `role_capabilities`.
5. **App y Edge:** leer capacidades desde BD (o una API que use `role_capabilities`) en lugar de listas fijas de role codes.

---

## 2. Tipos de sede y geofence (“vento_group”)

**En BD hoy:** `sites.type` (text), `sites.site_type` (enum: satellite, production_center, admin), `sites.checkin_radius_meters` (default 50).

**Hardcodeado:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| **enforce_attendance_geofence** | `v_site.type <> 'vento_group'` → si no es vento_group exige coordenadas y distancia | Saltar o aplicar validación GPS |
| **resolve_product_sku_brand_code** | `when 'vento_group' then return 'VGR'` | Código de marca para SKU |
| **App / Edge** | site_type para reportes: satellite, production_center; nombre "Vento Group" en scripts | Reportes, cuenta de prueba |

**Problema:** El valor `vento_group` está embebido en trigger y función; no hay tabla que diga “este tipo no requiere geofence”.

**Propuesta:**

1. **Opción A – Columna en `sites`:** `requires_geofence boolean default true`. Para la sede “App Review” y las de tipo virtual se pone `false`. El trigger usa `v_site.requires_geofence` en lugar de `v_site.type <> 'vento_group'`.
2. **Opción B – Tabla `site_type_config`:** clave por `sites.type` (text) con columna `requires_geofence`. Trigger y app leen de ahí.
3. Mantener `type` para SKU/brand si hace falta; la regla “requiere o no geofence” queda como dato en BD.

---

## 3. Política de geofence (radios y precisión)

**En BD hoy:** Trigger `enforce_attendance_geofence`: `v_cap := 20` (check_in), `30` (check_out); `v_max_acc := 20` / `25`; `coalesce(checkin_radius_meters, 50)`.

**Hardcodeado:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| **Schema – enforce_attendance_geofence** | 20, 20, 30, 25, 50 | Límites en trigger |
| **App – use-attendance.ts** | radiusCapMeters 20/30, maxAccuracyMeters 20/25, fallback 50, timeouts 20s/30s/1.5s/2s | Cliente |
| **App – geolocation.ts** | maxAccuracyMeters 50, radiusCap 35, locationTimeoutMs 15000, etc. | Validación ubicación |

**Problema:** Cambiar política implica tocar trigger y app; fácil desincronizar.

**Propuesta:**

1. **Tabla `attendance_policy`** (una fila global o por tenant si en el futuro hay multi-tenant):
   - `check_in_radius_cap_m`, `check_out_radius_cap_m`
   - `check_in_max_accuracy_m`, `check_out_max_accuracy_m`
   - `default_site_radius_m`
2. **Función `get_attendance_policy() returns attendance_policy`** (o tipo record) que lea esa tabla.
3. **Trigger:** en lugar de 20/30/25/50 literales, llamar a `get_attendance_policy()` y usar sus valores.
4. **App:** al cargar flujo de asistencia, obtener la política desde Supabase (RPC o tabla con RLS de solo lectura) y usar esos números. Timeouts de UX pueden seguir en código o pasarse a config más adelante.

---

## 4. Cuenta de revisión (Apple/Google)

**En BD hoy:** Usuario en Auth; filas en `employees` y `employee_sites`. Scripts crean sede “App Review” y asignan al usuario de prueba.

**Hardcodeado:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| .env, eas.json, auth.ts | REVIEW_EMAILS, REVIEW_PASSWORD | Login automático para ese email |
| SQL create_test_account | test@ventogroup.com, [credencial privada], App Review (Apple/Google) | Crear empleado e invitación |
| SQL site_review_demo | test@ventogroup.com, App Review (Demo), APP-REVIEW, vento_group, admin, demo | Sede solo para revisión |

**Propuesta:**

- **Credenciales:** Mantener password en env/secrets.
- **Tabla `app_config`** (o `review_demo_config`): una fila con `review_demo_email`, `review_demo_site_name`, `review_demo_site_code` (opcional). Scripts SQL leen de ahí en lugar de literales. La app puede seguir usando env para el allowlist de email si se prefiere no exponer el email en una tabla pública.

---

## 5. Estados de documentos y scope

**En BD hoy:** Enums `document_status` (pending_review, approved, rejected), `document_scope` (employee, site, group). Tabla `document_types`.

**Hardcodeado:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| App documents.tsx | `type DocumentStatus = "pending_review" \| "approved" \| "rejected"` | Tipado y filtros |
| Edge document-alerts | `.neq("status", "rejected")` | Qué documentos incluir en alertas |

**Propuesta:** App y Edge usar los valores que vienen del schema (tipos generados de Supabase o query a los enums). No duplicar el union type a mano; si se añade un estado en BD, regenerar tipos o leer de API.

---

## 6. Novedades / Anuncios

**En BD hoy:** No existe tabla `announcements`.

**Hardcodeado:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| src/components/announcements/data.ts | Array ANNOUNCEMENTS (id, title, body, tag, date) | Pantalla Novedades |

**Propuesta:**

- **Tabla `announcements`:** id, title, body, tag (text o enum), published_at, is_active, display_order, created_at, updated_at. RLS: solo filas con is_active para lectura autenticada.
- App: pantalla hace select a esa tabla; se elimina el array en código.

---

## 7. Timezone y locale

**En BD hoy:** Función `close_open_attendance_day_end(p_timezone text default 'America/Bogota')`; cron que la invoca con `'America/Bogota'`.

**Hardcodeado:**

| Dónde | Qué | Uso |
|-------|-----|-----|
| Schema close_open_attendance_day_end | default 'America/Bogota' | Cierre de turno al final del día |
| Cron (si está en schema o en Dashboard) | 23:59 local = 04:59 UTC para Colombia | Schedule |
| App (home, history, documents) | "es-CO" en toLocaleDateString / toLocaleTimeString | Formato fechas |
| Edge attendance-report | Intl.DateTimeFormat("es-CO", ...) | Formato en reporte |

**Propuesta:**

- **Tabla `app_config`:** columnas `timezone` (ej. America/Bogota), `locale` (ej. es-CO). Una fila por “tenant” o global.
- **Cierre de turno:** invocar `close_open_attendance_day_end( (select timezone from app_config limit 1) )` en lugar de literal.
- **App / Edge:** cargar locale (y opcionalmente timezone) desde config al inicio; usar en Intl y toLocale*. Default en código `es-CO` si no hay config.

---

## 8. URLs y entorno

**En BD hoy:** Nada; todo en env.

**Hardcodeado:** EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_INVITE_URL; fallback `anima://invite` en staff-invitations-create.

**Propuesta:** Mantener URLs en env. Opcional: en `app_config` guardar `invite_redirect_url` o `invite_scheme` para que la Edge Function use ese valor con fallback a env, y no tener el literal `anima://invite` en código.

---

## 9. Marca y textos de UI

**Hardcodeado:** “Vento Group SAS” (splash), “solicita soporte a tu administrador”, placeholders (“No puedo registrar entrada en Vento Group”), etc.

**Propuesta:** Tabla `app_config` o `branding`: company_name, support_placeholder, footer_text, etc. App carga al inicio y usa en splash y placeholders. Alternativa: i18n (JSON) con claves; BD solo si quieres editarlo desde un panel admin.

---

## 10. Resumen: qué falta en el schema para que la BD sea la fuente de verdad

| Elemento | Acción en BD |
|----------|----------------|
| **Roles y permisos** | Tabla `role_capabilities` (role_code, capability). Función `employee_has_capability(uid, capability)`. Sustituir en RLS y en `is_owner`/`is_global_manager`/`is_manager`/`is_manager_or_owner` y en `can_access_recipe_scope`. |
| **Geofence por sede** | Columna `sites.requires_geofence` o tabla `site_type_config`. Trigger `enforce_attendance_geofence` que lea eso en lugar de `type <> 'vento_group'`. |
| **Política de asistencia** | Tabla `attendance_policy` (radios y precisiones). Función `get_attendance_policy()`. Trigger y app usan esos valores. |
| **Config global / tenant** | Tabla `app_config` (timezone, locale, review_demo_email, review_demo_site_name/code, invite_redirect_url, company_name, etc.). Una fila o por tenant. |
| **Novedades** | Tabla `announcements` (title, body, tag, published_at, is_active, display_order). |
| **Document status/scope** | Ya están en BD como enums; solo falta que app/Edge no dupliquen los valores y usen tipos/API. |

---

## 11. Orden sugerido de implementación

1. **app_config** (una fila): timezone, locale, company_name, review_demo_*, invite_redirect_url. Permite deshardcodear scripts, cierre de turno, marca y locale.
2. **attendance_policy** + **get_attendance_policy()** + ajuste del trigger y luego de la app. Una sola fuente para radios y precisión.
3. **sites.requires_geofence** (o site_type_config) y cambio en **enforce_attendance_geofence** para dejar de usar el literal `vento_group`.
4. **role_capabilities** + **employee_has_capability()** + migrar RLS y funciones (`is_owner`, `is_manager`, etc.) a usar capacidades.
5. **announcements** y sustituir el array en la app.
6. Opcional: branding/i18n en BD si quieres editar copy desde admin.

Cuando quieras, el siguiente paso puede ser bajar esto a migraciones SQL concretas (crear tablas, funciones, y cambios en trigger/RLS) sin tocar aún la app.
