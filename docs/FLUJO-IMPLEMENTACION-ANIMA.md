# Flujo de implementación ANIMA — una sola opción

> Orden único de tareas hasta completar Fase 2 (y apuntes para Fase 3/4).  
> Fecha: 2026-03-13. No hay ramas: se sigue este orden.

---

## Regla

- Implementar **en el orden indicado**.
- Marcar cada ítem como hecho cuando esté terminado y probado.
- No saltar ítems (salvo que se indique explícitamente “opcional”).

---

## Estado previo (ya hecho)

- [x] Fase 1: Invitaciones (tabla, create/accept/resend/cancel, bandeja en Equipo).
- [x] Campo Expira en modal de invitar (ANIMA).
- [x] Banner “Activar notificaciones” en Home cuando el permiso no está concedido.
- [x] Pantalla “Mis turnos” en ANIMA.
- [x] Planner semanal en VISO (copiar semana, publicar).
- [x] Flujo de publicación de turnos (`published_at`, migración correspondiente).

---

## Secuencia de implementación

### Bloque A — Turnos: empleado en ANIMA

1. **Tarjeta “Siguiente turno” en Home** — **HECHO**  
   - En `app/(app)/home.tsx`, reutilizar o conectar con la fuente de “próximo turno” (ya existe `loadNextScheduledShift` o equivalente).  
   - Mostrar una tarjeta fija en Home con: fecha, hora inicio–fin, sede, y enlace “Ver mis turnos”.  
   - Solo visible si hay al menos un turno publicado futuro para el empleado.  
   - Definición de hecho: el empleado ve en Home su próximo turno sin entrar a “Mis turnos”.

2. **Notificación al asignar o cambiar turno** — **HECHO**  
   - Backend: al publicar o actualizar turnos (VISO o función que persista en `employee_shifts`), disparar envío de push al empleado afectado (usar token de `register-push-token` o tabla equivalente).  
   - Mensaje tipo: “Tienes un turno nuevo” / “Tu turno del [fecha] fue actualizado”.  
   - Definición de hecho: cuando publican o editan un turno, el empleado recibe notificación push (si tiene permiso).

---

### Bloque B — Turnos: manager en ANIMA (móvil)

3. **Crear turno individual desde la app** — **HECHO**  
   - Nueva pantalla o modal en ANIMA (solo para roles con permiso: gerente/propietario): formulario para crear un turno (empleado, sede, fecha, hora inicio, hora fin, opcional descanso).  
   - Llamar a una edge function o RPC que inserte en `employee_shifts` con `status = 'draft'` o `'published'` según regla de producto.  
   - Definición de hecho: un manager puede crear un turno puntual desde la app sin usar VISO.

4. **Editar turno individual desde la app** — **HECHO**  
   - Desde “Mis turnos” o una vista de manager, permitir abrir un turno y editar: fecha, hora inicio/fin, empleado (si aplica), sede.  
   - Persistir cambios vía backend existente o RPC.  
   - Definición de hecho: el manager puede corregir un turno desde la app.

5. **Cancelar o confirmar turno desde la app** — **HECHO**  
   - Acciones “Cancelar turno” y “Confirmar turno” (según estados definidos en modelo: p. ej. `cancelled`, `confirmed`).  
   - Backend: actualizar `status` y campos de auditoría si existen.  
   - Definición de hecho: el manager puede cancelar o marcar como confirmado un turno desde la app.

6. **Reemplazos simples (manager)** — **HECHO**  
   - Flujo mínimo: “Reasignar turno” a otro empleado (cambiar `employee_id` del turno).  
   - Puede ser un paso más en la pantalla de edición del turno.  
   - Definición de hecho: el manager puede reasignar un turno a otra persona desde la app.

---

### Bloque C — Turnos: web (VISO)

7. **Validar solapes en el planner** — **HECHO**  
   - En `weekly-schedule-planner` (o en el backend al guardar): detectar solapamiento de turnos del mismo empleado (misma fecha, rangos de hora que se cruzan).  
   - Mostrar advertencia en UI y/o impedir guardar hasta resolver o confirmar.  
   - Definición de hecho: no se pueden guardar turnos que se solapan para el mismo empleado sin una advertencia clara.

8. **Gestión por sede en planner** — **HECHO**  
   - Si aún no está: filtrar o agrupar el planner por sede de forma clara (ya puede estar parcialmente; completar si falta).  
   - Definición de hecho: el usuario del planner puede trabajar por sede sin confusión.

---

### Bloque D — Integración asistencia / turnos

9. **Mostrar próximo turno en Home** — **HECHO**  
   - Ya cubierto por el ítem 1; se añadió el detalle “Según tu turno programado” en la tarjeta cuando es turno de hoy.  
   - Definición de hecho: en Home se ve claramente el turno del día o el próximo.

10. **Relacionar check-in con turno programado (opcional en MVP)** — **HECHO**  
    - Columna `attendance_logs.shift_id` (opcional); al hacer check-in en sede/fecha de un turno publicado se persiste la relación.  
    - En Home se muestra “Dentro de tu turno de hoy” cuando el check-in es en la sede del turno.  
    - No se bloquea check-in si no hay turno.  
    - Definición de hecho: se puede ver o registrar la relación entre asistencia y turno cuando aplica.

---

### Bloque E — Fase 3 (parametrización)

11. **Tabla y lectura de políticas de asistencia** — **HECHO**  
    - Tabla `public.attendance_policy` con: geofence (check-in/check-out max accuracy), tolerancia de tardanza, cache/latch de geofence, parámetros de departure.  
    - Hook `useAttendancePolicy()` lee el primer registro; la app usa esos valores con fallback a constantes.  
    - Definición de hecho: cambios de radio o tolerancia se hacen por BD, no por release.

12. **Tabla y lectura de políticas por sede** — **HECHO**  
    - Tabla `public.site_attendance_policy` (site_id PK, checkin_radius_meters, requires_geofence).  
    - En `resolveSite` se consulta opcionalmente; si hay fila se usan overrides, si no o falla se usa sites + coordenadas.  
    - Definición de hecho: configuración por sede vive en BD.

13. **Capacidades por rol** — **HECHO**  
    - Tabla `public.role_capabilities` (role, capability) con RLS de solo lectura para authenticated; seed para propietario/gerente_general/gerente con `shift.create`, `shift.edit`, `shift.cancel`, `team.view`, `team.invite`. Hook `useRoleCapabilities(role)` lee capacidades; en `shifts.tsx` se usa `shift.create` (fallback a MANAGEMENT_ROLES); en `team.tsx` se usan `team.view` y `team.invite` (fallback a MANAGEMENT_ROLES).  
    - Definición de hecho: permisos de “quién puede hacer qué” vienen de BD.

14. **Config global de app** — **HECHO**  
    - Tabla `public.app_config` (key, value jsonb) con RLS SELECT para authenticated y anon; seed locale=es-CO, timezone=America/Bogota, feature_flags={}. Textos clave con keys `text.*`.  
    - Hook `useAppConfig()` devuelve locale, timezone, featureFlags, getText(key) y loaded/refresh; fallback a defaults si falla la lectura.  
    - Definición de hecho: ajustes operativos sin tocar código.

15. **Políticas de turnos** — **HECHO**  
    - Tabla `public.shift_policy` (una fila: publication_notice_minutes, reminder_minutes_before_shift, max_shift_hours_per_day, min_hours_between_shifts) con RLS SELECT para authenticated; seed 60 min recordatorio, 12 h máx por turno.  
    - Hook `useShiftPolicy()` con fallback a defaults; en CreateShiftModal y EditShiftModal se valida duración frente a max_shift_hours_per_day.  
    - Definición de hecho: reglas de turnos configurables en BD.

---

### Bloque F — Fase 4 (schema anima)

16. **Inventario y migración a schema `anima`**  
    - Listar tablas/funciones ANIMA en `public`.  
    - Crear schema `anima` y migrar por capas (config → turnos/invitaciones → asistencia), con vistas o wrappers en `public` si hace falta durante la transición.  
    - Definición de hecho: lo nuevo nace en `anima` y hay ruta clara para el resto.

---

## Resumen del orden (una sola opción)

1. Tarjeta siguiente turno en Home  
2. Notificación al asignar/cambiar turno  
3. Crear turno individual (manager, app)  
4. Editar turno individual (manager, app)  
5. Cancelar / confirmar turno (manager, app)  
6. Reemplazos simples (reasignar empleado)  
7. Validar solapes en planner (VISO)  
8. Gestión por sede en planner (completar si falta)  
9. Refinar “próximo turno” en Home si falta  
10. (Opcional) Relacionar check-in con turno  
11–15. Fase 3: políticas y config en BD  
16. Fase 4: schema anima  

Al terminar cada ítem, marcar en este documento y seguir con el siguiente.


---

## ANEXO QA ANDROID - RECUPERACION DE ANIMA DEV DESPUES DE REINICIAR WINDOWS

**Fecha de registro:** 2026-10-18. **Alcance:** \`GAP-PKG-004\`; estado \`MATURATION_DRAFT\`. Este procedimiento operativo no modifica la secuencia de implementación anterior ni convierte pruebas pendientes en PASS.

### Regla: verificar identidades, no memorizar IDs

El servidor Metro, el puerto, la IP, el enlace Expo, los UUID/nombres Docker, el proceso, el serial ADB y la sesión MCP pueden cambiar tras cada reinicio. Hay tres identidades independientes que deben comprobarse: (a) ANIMA Dev, paquete Android \`com.vento.anima.dev\`, esquema \`anima-dev\`; (b) Metro perteneciente al workspace real \`vento-anima\` y ejecutado con \`APP_VARIANT=development\`; (c) Supabase QA aislado del alcance \`GAP-PKG-004\`. La configuración base de ANIMA selecciona **producción por defecto** cuando falta \`APP_VARIANT\`, por lo que el paquete \`com.vento.anima\` NO identifica la app de QA.

### Orden de arranque validable

1. Abrir Docker Desktop, VS Code y los workspaces \`vento-shell\` y \`vento-anima\`. Consultar \`workspace_overview\` de VENTO MCP: conexión real, sesión local activa, scope \`GAP-PKG-004\` y capacidad \`qa_synthetic\` para pruebas de datos. Repetir una vez si hay un error de conexión transitorio. No reutilizar índices de workspace o seriales de una sesión anterior.
2. Confirmar el stack Supabase QA aislado ya configurado. Desde \`vento-shell\`, ejecutar el script existente \`npm run qa:isolated:viso\`. Continuar solo ante \`QA_TARGET: VERIFIED\`, \`QA_REST_BINDING: PASS\`, \`QA_HTTP_AUTH: PASS\`, migraciones consistentes y sin residuos sintéticos. Es un preflight, no inicia Supabase. Si falla, detenerse; nunca recurrir al Supabase principal, STAGING, producción, \`supabase db reset\` o credenciales de servicio dentro de Android.
3. Abrir el Android Emulator y ejecutar \`android_devices\`. Confirmar mediante \`android_app_status\` que la aplicación DEV \`com.vento.anima.dev\` está instalada. El serial \`emulator-5554\` fue observado anteriormente, pero no es una constante.
4. En **una terminal PowerShell situada en la raíz real de \`vento-anima\`**, configurar la variante en la misma sesión y verificar identidad **antes** de ejecutar Metro:

   ~~~powershell
   $env:APP_VARIANT = 'development'
   node -p "require('./package.json').name"
   node -p "require('./app.config.js')().expo.android.package"
   ~~~

   Las salidas obligatorias son \`anima\` y \`com.vento.anima.dev\`. Si no coinciden, no arrancar Expo. \`APP_VARIANT\` debe pertenecer al proceso Metro, no solo al emulador.
5. Comprobar si existe ya un Metro correcto. Solo si no existe, iniciarlo **en esa terminal** con el script real de \`package.json\`:

   ~~~powershell
   npm run start -- --dev-client --localhost --port 8081
   ~~~

   Mantener la terminal abierta y comprobar \`Starting project at ...\` y \`Metro waiting on ...\`. El puerto es un valor inicial solicitado y puede variar; no guardar la URL de ese día ni iniciar otro Metro a ciegas.
6. Ejecutar \`android_qa_connect_metro\` en el MCP con el workspace, paquete y emulador descubiertos **en la sesión actual**. Para Expo SDK 54 la extensión debe validar el manifiesto del servidor y obtener el enlace desde \`/_expo/link?choice=expo-dev-client&platform=android\`, utilizar ADB reverse únicamente para el emulador y abrir \`com.vento.anima.dev\`. El usuario no suministra URL, puerto ni comandos ADB.
7. Tomar \`android_screenshot\`. La pantalla válida es el **login real de ANIMA**, no \`ANIMA Dev / Development Build / Development Servers\`. \`android_app_status.foreground=true\` solo acredita primer plano: no confirma que cargó el bundle.
8. Verificar el backend Supabase realmente utilizado **desde la app Android**, no solo desde el host Windows. Los puertos QA del host observados son API \`127.0.0.1:23151\` y PostgreSQL \`127.0.0.1:20545\`; \`127.0.0.1\` en Android no debe confundirse con el host sin reenvío verificado. La app nunca recibe claves \`service_role\`.
9. Tras verificar backend aislado y autorizar QA sintética, ejecutar login, check-in de sede sintética y GPS \`inside\`, \`outside_first\` y \`outside_second\` usando \`android_qa_set_location\`. Separar las muestras exteriores al menos **45 segundos**. El ACK de ADB no demuestra recepción en ANIMA ni aviso de geocerca; comprobar eventos/estado/capturas. Mantener la protección anti-mock.
10. Limpiar exclusivamente identidades y fixtures de esa sesión mediante \`android_qa_cleanup\` cuando corresponda; verificar residuos. No resetear otras bases ni eliminar usuarios ajenos.

### Diagnostico fijo de errores

| Resultado | Significado | Acción segura |
| --- | --- | --- |
| \`ANDROID_QA_METRO_NOT_RUNNING\` | No se detectó Metro en el rango inspeccionado | Revisar el proceso y la terminal de \`vento-anima\` |
| \`ANDROID_QA_METRO_OTHER_PROJECT\` | Existe Metro pero su manifiesto no anuncia \`com.vento.anima.dev\` | Verificar carpeta real, variante y otros servidores; no forzar |
| \`ANDROID_QA_METRO_OPEN_ENDPOINT_UNAVAILABLE\` | La versión anterior del MCP utilizaba \`/_expo/open\` | Confirmar compatibilidad SDK 54 con \`/_expo/link\` |
| \`Invalid URL host: ""\` | El launcher de Expo intentó abrir una URL inválida | No insistir con "Fetch development servers"; verificar Metro |
| \`ANDROID_QA_NOT_ON_DECLARED_LOGIN_SCREEN\` | La aplicación aún no muestra login | Captura y diagnóstico de la carga JavaScript |
| \`ANDROID_QA_GPS_SECOND_SAMPLE_TOO_EARLY\` | Menos de 45 s entre muestras exteriores | Esperar antes de repetir la segunda |
| Error de identidad/atestación del backend QA | Backend no validado | Bloquear identidades y operaciones de asistencia |

Para identificar procesos Metro **sin matarlos** en Windows:

~~~powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 8081 -and $_.LocalPort -le 8090 } |
  ForEach-Object {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
    [pscustomobject]@{
      Port = $_.LocalPort
      PID = $_.OwningProcess
      CommandLine = $proc.CommandLine
    }
  }
~~~

No terminar procesos ajenos ni relajar la validación del paquete Android.

### Estado abierto y criterio de cierre

**Última evidencia:** VENTO MCP conectado, emulador disponible, la herramienta \`android_qa_connect_metro\` invocable y rechazo \`ANDROID_QA_METRO_OTHER_PROJECT\`. **No se ha demostrado** el proceso exacto responsable, la carga de ANIMA, el endpoint efectivo de su JavaScript, login, geocerca ni aviso de salida.

**Estado de automatización:** v0.13.17 solo conecta a Metro ya iniciado. El candidato instalable v0.13.18 añade arranque supervisado al invocar `android_qa_connect_metro`, con variante `development`, proyecto ANIMA verificado y backend QA aislado, sin terminar procesos ajenos. Sus pruebas locales no equivalen a validación en Windows: **queda pendiente instalarlo, comprobar la carga efectiva de ANIMA y repetir tras reiniciar el PC**. No inicia Metro por sí mismo durante el arranque de Windows.

**Cierre de recuperación:** una ejecución completa después de reinicio debe demostrar, sin IDs antiguos, Metro ANIMA Dev, pantalla de login, conexión aislada real, QA de geocerca, limpieza de fixtures y repetibilidad.
