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

**Última evidencia verificada:** VENTO MCP y emulador conectados. El arranque automático v0.13.19 devolvió `ANDROID_QA_METRO_AUTO_START_TIMEOUT`; **el usuario abrió manualmente ANIMA desde el cliente de desarrollo**. La captura posterior confirmó `Connected to: http://10.0.2.2:8081` y, tras cerrar el menú de desarrollador, mostró **la pantalla real de inicio de sesión de ANIMA**. Por tanto, el bundle sí cargó por el flujo manual. **No está demostrado** que el backend dentro de la aplicación sea el Supabase QA aislado, ni están verificadas autenticación, asistencia, geocerca, notificación o recuperación automática tras reinicio.

### Verificación manual real de conexión (2026-10-18)

**Ruta corta comprobada en el emulador:** con Metro en ejecución, abrir `ANIMA Dev`, seleccionar/conectar el servidor de desarrollo que muestra el propio launcher y cerrar el menú de desarrollador (botón `X` o acción `Back`). La pantalla correcta es el login de ANIMA. No hace falta reinstalar la extensión ni esperar un supuesto PASS de `android_qa_connect_metro` cuando el cliente ya está conectado. La URL `http://10.0.2.2:8081` es **solo evidencia observada de esa sesión**, nunca una constante operativa; obtener el endpoint actual después de cada reinicio.

**Regla de diagnóstico:** después de un fallo del supervisor, **comprobar primero una captura del cliente Android y el estado de conexión visible en la interfaz**, antes de crear otra versión del VSIX. El fallo del supervisor no demuestra que la aplicación esté desconectada. El siguiente bloqueo funcional es verificar el backend QA efectivo desde la app antes de usar datos sintéticos.

**Estado de automatización:** v0.13.17 solo conecta a Metro ya iniciado. El candidato instalable v0.13.18 añade arranque supervisado al invocar `android_qa_connect_metro`, con variante `development`, proyecto ANIMA verificado y backend QA aislado, sin terminar procesos ajenos. Sus pruebas locales no equivalen a validación en Windows: **queda pendiente instalarlo, comprobar la carga efectiva de ANIMA y repetir tras reiniciar el PC**. No inicia Metro por sí mismo durante el arranque de Windows.

**Cierre de recuperación:** una ejecución completa después de reinicio debe demostrar, sin IDs antiguos, Metro ANIMA Dev, pantalla de login, conexión aislada real, QA de geocerca, limpieza de fixtures y repetibilidad.
---

### Actualización QA Android — v0.13.21: control visual del emulador completo

**Diagnóstico confirmado:** hasta VENTO VS Code MCP v0.13.20 la función `screenAccessFor()` bloqueaba `android_screenshot`, `android_tap`, `android_swipe`, `android_input_text` y `android_back` cuando `ANIMA Dev` no estaba en primer plano. Esto impedía observar o recuperar el launcher de Expo, la pantalla inicial Android, Settings y permisos nativos, aunque el dispositivo ya se había verificado como emulador QEMU autorizado. El error `ANDROID_DEV_APP_NOT_FOREGROUND` era del *alcance de la herramienta*, no evidencia suficiente de un crash, desconexión, login fallido ni cierre de ANIMA.

**Evidencia visual del incidente:** dos capturas compartidas el 2026-10-19 muestran el cuadro Android «Allow ANIMA Dev to access this device's location?» superpuesto a Home de ANIMA «Hola, VENTO». El cuadro de permiso del sistema es esperado y confirma la transición visual a Home; no certifica por sí solo autenticación del backend ni funcionamiento de geocerca. Dos capturas del mismo diálogo no prueban que Android lo haya solicitado dos veces.

**Comportamiento requerido desde v0.13.21:** las acciones ordinarias de pantalla `android_screenshot`, `android_tap`, `android_swipe`, `android_input_text` (texto QA no sensible) y `android_back` deben funcionar sobre **todo el emulador QA QEMU verificado**, incluso si `android_app_status` devuelve `OUTSIDE_DECLARED_APP`. Ese estado solo describe el primer plano. La captura puede incluir ANIMA, launcher Expo, diálogos nativos, Ajustes y otras pantallas del emulador sin inferir errores. La herramienta `android_qa_allow_foreground_location` conserva la interpretación de la ubicación precisa y el permiso mientras se usa la aplicación.

**Protecciones que permanecen:** la conexión requiere origen Git y workspace Expo DEV gobernados, sesión vigente GAP-PKG-004, autorización local temporal, app declarada instalada y `ro.kernel.qemu=1`. No hay comandos ADB libres ni teléfonos físicos. `android_qa_login` sigue requiriendo ANIMA en primer plano y pantalla de login real; la identidad sintética y las operaciones de Supabase, GPS y limpieza siguen limitadas al QA aislado. Una captura integral no se anonimiza, por lo que el emulador debe contener solo datos sintéticos.

**QA del VSIX entregable v0.13.21:** 375 entradas preservadas; 368 sin modificaciones. Dos rondas independientes de pruebas ejecutadas directamente desde el VSIX final: **26/26 PASS** cada una. Pruebas nuevas cubren launcher, Settings, permiso Android, otra actividad, clasificación desconocida, rechazo de dispositivos sin QEMU, restricción de login sintético, ausencia de argumentos ADB arbitrarios y texto sensible. Sintaxis JavaScript, manifest y ZIP: PASS. **El resultado en el emulador real Windows sigue pendiente hasta instalar v0.13.21**. No declarar completado GAP-PKG-004 por estas pruebas.

**Regla obligatoria para futuras conversaciones:** al obtener `OUTSIDE_DECLARED_APP` o `ANDROID_DEV_APP_NOT_FOREGROUND`, primero inspeccionar visualmente la pantalla completa del emulador mediante `android_screenshot` (v0.13.21). No reiniciar componentes, borrar datos, crear otro usuario QA, editar el MCP ni concluir error sin evidencia visual. Si no aparece ANIMA, recuperar la sesión navegando desde el launcher dentro del emulador con `android_tap`/`android_back`, conservando el QA backend y distinguiendo el fallo independiente `ANDROID_QA_METRO_DEEPLINK_INVALID`.

**Prioridad operacional:** esta corrección v0.13.21 sustituye la anterior restricción a la aplicación en primer plano del anexo 2026-10-18. Los pasos de arranque que no fijaban `EXPO_PUBLIC_SUPABASE_*` no deben usarse para certificar QA aislado: el proceso Metro debe recibir la URL y la clave pública del stack aislado verificado; no se admiten API remotas ni producción.
---

### Validación real v0.13.22: login Android 17 y permiso de ubicación (2026-10-19)

**Alcance:** `GAP-PKG-004`, ANIMA Dev en emulador QEMU Android 17. Ejecución por VENTO VS Code MCP v0.13.22; no implica cierre del paquete ni cambio de requisitos históricos.

**PASS confirmado — login sin falso bloqueo de primer plano:** `android_screenshot` mostró el formulario real de ANIMA con pie `QA • API 10.0.2.2:23151 (sin verificar)`, aunque `android_app_status` seguía devolviendo `foreground:false`, `screen_context:OUTSIDE_DECLARED_APP`. Tras verificar el entorno aislado (`QA_TARGET: VERIFIED`, `QA_HTTP_AUTH: PASS`, `QA_REST_BINDING: PASS`, 23 migraciones y residuo 0), `android_qa_login` devolvió `submitted:true`, `isolated_backend_verified:true`, `synthetic_identity:true`, `login_surface_attestation:DECLARED_PACKAGE_UIAUTOMATOR`, `navigation_state:SUBMITTED_PENDING_VERIFICATION`. **La regresión `ANDROID_DEV_APP_NOT_FOREGROUND` del login se resolvió en la prueba real sin retirar controles de entorno QA.**

**PASS visual — Home y diálogo de ubicación legítimo:** la captura inmediata posterior mostró la pantalla principal «Hola, VENTO» y el diálogo del sistema Android «Allow ANIMA Dev to access this device's location?», con `Precise` seleccionado. Ese cuadro es un **permiso nativo esperado, NO crash, NO error de login, NO fallo de Metro**. La pantalla Home confirma navegación visual; la respuesta de login por sí sola no prueba el resultado final. No se ha demostrado que el sistema pidiera ese permiso dos veces.

**FALSO NEGATIVO pendiente en clasificador de permiso:** mientras el cuadro de ubicación estaba visible en la captura, `android_app_status` indicó `native_permission_dialog_pending:false` y `android_qa_allow_foreground_location` devolvió `ANDROID_QA_LOCATION_NATIVE_DIALOG_NOT_VISIBLE`. **No inferir ausencia del permiso cuando una captura válida lo muestra.** El detector específico permanece pendiente de corrección. En esta ejecución se usó `android_tap` con coordenadas verificadas para aceptar `Precise` / `While using the app`; la captura posterior mostró Home «Hola, VENTO», botón «Iniciar turno», «Sin iniciar», sin diálogo ni bloqueo.

**Límites de la evidencia:** el preflight autentica el host QA aislado y el login navega visualmente a Home, pero `in_app_backend_verified:false` no se convierte automáticamente en PASS de atestación HTTP originada dentro de Android. El pie `(sin verificar)` tampoco es atestación del backend. La geocerca, `attendance_policy`, check-in, check-out y notificaciones no se validaron aquí; no se generaron registros de asistencia.

**Cierre de fixtures:** `android_qa_cleanup` devolvió `synthetic_residue:CLEANED`, `isolated_backend_verified:true`, `app_force_stopped:true`, `dev_app_data_cleared:true`. Nueva ejecución de `qa:isolated:viso`: PASS, `QA_SYNTHETIC_RESIDUAL_COUNTS: 0|0|0|0`, `QA_WRITES:0`, 23 migraciones. La limpieza detuvo ANIMA y borró datos de ANIMA Dev intencionalmente; una nueva sesión debe abrirse de nuevo antes de probar otros escenarios.

**Geocerca:** una búsqueda literal sobre `docs/plan-canonico/modular/package-gate-instances/GAP-PKG-004.json` no encontró `qa_geofence`. No inventar coordenadas o escenarios GPS. Antes de probar `android_qa_set_location`, verificar que existe declaración canónica vigente y consentimiento QA GPS separado.

**Regla para otras conversaciones:** priorizar la inspección de `android_screenshot` ante estados ADB contradictorios. `screen_context:OUTSIDE_DECLARED_APP` no invalida una pantalla ANIMA visualmente confirmada; `android_qa_login` v0.13.22 verifica el formulario mediante UIAutomator. Si aparece el permiso de ubicación, no repetir login, no limpiar fixtures prematuramente y no llamar crash al modal de Android; el detector específico puede dar `ANDROID_QA_LOCATION_NATIVE_DIALOG_NOT_VISIBLE` falsamente. Conservar la evidencia y resolver el modal bajo autorización QA, comprobando después otra captura. Separar siempre navegación visual de atestación HTTP del backend.
---

### Corrección MCP v0.13.23 — detector de permiso nativo Android 17

**Incidente real que origina la corrección:** en v0.13.22 la captura del emulador mostró la pantalla Home «Hola, VENTO» superpuesta por «Allow ANIMA Dev to access this device’s location?». Sin embargo, `android_app_status.native_permission_dialog_pending=false` y `android_qa_allow_foreground_location` falló con `ANDROID_QA_LOCATION_NATIVE_DIALOG_NOT_VISIBLE`. El problema radica en la dependencia estricta de `dumpsys activity`/`dumpsys window`, que puede discrepar de la ventana visible en Android 17. **Este permiso NO equivale a un crash de ANIMA, fallo de login o pérdida de conexión.**

**Implementación v0.13.23:** se mantiene el alcance GAP-PKG-004 y el emulador QEMU atestado. La identificación del permiso utiliza una segunda evidencia de UIAutomator: nodos pertenecientes a `com.android.permissioncontroller` o `com.google.android.permissioncontroller`; título de solicitud de ubicación que identifica **exactamente** el nombre DEV de la app; y controles inequívocos `Precise`, `Approximate` y `While using the app` (o equivalentes españoles). El nombre DEV se extrae como literal de `development` en `src/brand/<app>/config/expo-brand.js` y se cruza con el paquete Android declarado; el cliente MCP no suministra el nombre.

**Robustez y seguridad:** cuando el XML comprimido omite etiquetas relevantes, se intenta una lectura no comprimida, ambas en memoria y con límites. `android_qa_allow_foreground_location` verifica la interfaz ANTES de pulsar «Precise» y verifica de nuevo el mismo destinatario y los controles ANTES de autorizar uso en primer plano. Se rechazan otras apps, controles duplicados, títulos ambiguos, permisos diferentes y XML incompleto. `android_app_status` y los metadatos de `android_screenshot` pueden indicar `PERMISSIONCONTROLLER_UIAUTOMATOR_DEV_LABEL` incluso cuando `dumpsys` reporta `OUTSIDE_DECLARED_APP`. Esta atestación de UI **no prueba** éxito de login, conexión HTTP dentro de ANIMA ni resultado de geocerca.

**Alcance inalterado:** no se alteran Supabase, `attendance_policy`, ANIMA, credenciales, reglas de GPS simulado ni herramientas para dispositivos físicos; no se introducen comandos ADB arbitrarios. Los consentimientos locales temporales y el alcance QA aislado permanecen obligatorios.

**Pruebas ejecutadas sobre el VSIX final:** dos rondas independientes de 42/42 PASS; sintaxis Node PASS; integridad ZIP y manifiesto PASS; 375 entradas originales preservadas, 369 sin cambios. Estos resultados son **locales/simulados**, por lo que el reconocimiento en el emulador real Windows v0.13.23 está PENDIENTE hasta instalarlo y reproducir el permiso.

**Precisión sobre geocerca canónica:** una búsqueda de texto anterior sin coincidencias para `qa_geofence` NO acredita ausencia: el lector MCP rechazó posteriores intentos con `FILE_TOO_LARGE` por el tamaño del expediente local. En la ejecución real de v0.13.22, `android_qa_allow_foreground_location` superó la comprobación inicial de geocerca y falló después en la detección visual. No deducir coordenadas ni autorizar pruebas de asistencia a partir de una búsqueda incompleta. Los valores y permisos del escenario deben verificarse desde la fuente canónica local vigente antes de generar GPS sintético.
---

### Validación real v0.13.23 — permiso nativo Android 17 (2026-10-19)

**Alcance:** `GAP-PKG-004`, VENTO VS Code MCP v0.13.23 instalado en Windows, ANIMA Dev (`com.vento.anima.dev`) en `emulator-5554` Android 17 QEMU. No cambia el estado `MATURATION_DRAFT` ni constituye aprobación para otro paquete.

**Preflight anterior al login:** `qa:isolated:viso` devolvió PASS; `QA_TARGET: VERIFIED`, `QA_REST_BINDING: PASS`, `QA_HTTP_AUTH: PASS`, 23 migraciones y `QA_SYNTHETIC_RESIDUAL_COUNTS: 0|0|0|0`. Esto verifica Supabase QA aislado desde el host, no atesta por sí solo solicitudes HTTP de ANIMA.

**Ejecución de login:** la captura del emulador mostró el formulario real de ANIMA y el pie `QA • API 10.0.2.2:23151 (sin verificar)` tras conectar manualmente el servidor de Metro `10.0.2.2:8082` desde el launcher Expo. `android_qa_login` devolvió `submitted:true`, `synthetic_identity:true`, `isolated_backend_verified:true`, `login_surface_attestation:DECLARED_PACKAGE_UIAUTOMATOR`, `navigation_state:SUBMITTED_PENDING_VERIFICATION`, `app_navigation_verified:false` y `in_app_backend_verified:false`. El resultado del ejecutor no demuestra autenticación exitosa por sí solo.

**PASS real — falso negativo de permiso corregido:** la captura inmediata posterior mostró el diálogo Android «Allow ANIMA Dev to access this device's location?» con opción `Precise`, superpuesto a Home «Hola, VENTO». Por primera vez, los metadatos de `android_screenshot` reportaron `native_permission_dialog_pending:true`, `native_permission_kind:LOCATION`, `native_permission_attestation:PERMISSIONCONTROLLER_UIAUTOMATOR_DEV_LABEL`, y `android_app_status` reportó `screen_context:NATIVE_PERMISSION_DIALOG_UIAUTOMATOR`, `native_permission_dialog_pending:true`. Esto reproduce y cierra la regresión de clasificación de la v0.13.22. El diálogo es una interacción legítima de Android y NO crash, NO fallo de login, NO desconexión MCP.

**PASS de actuación controlada, con límite explícito:** `android_qa_allow_foreground_location` respondió `executed:true`, `native_location_dialog_verified:true`, `permission_dialog_attestation:PERMISSIONCONTROLLER_UIAUTOMATOR_DEV_LABEL`, `android_activity_focus_was_inconclusive:true`, `precise_option_tapped:true` y `foreground_permission_submitted:true`. Después, `android_screenshot` mostró Home «Hola, VENTO», botón «Iniciar turno», estado «Sin iniciar» y **sin diálogo**. Sin embargo, `permission_granted_verified:false` significa que la herramienta **todavía no certifica el estado de concesión mediante una lectura independiente del sistema**. El PASS confirmado corresponde a reconocimiento y resolución visual del diálogo, no a esa certificación adicional ni al backend dentro de ANIMA.

**Cierre de datos sintéticos:** `android_qa_cleanup` devolvió `synthetic_residue:CLEANED`, `isolated_backend_verified:true`, `app_force_stopped:true`, `dev_app_data_cleared:true`. Segundo `qa:isolated:viso`: PASS, 23 migraciones, `QA_SYNTHETIC_RESIDUAL_COUNTS: 0|0|0|0`, `QA_WRITES:0`. Al limpiarse los datos de ANIMA Dev, cualquier nuevo escenario de login requiere restablecer la sesión del cliente de desarrollo, sin reiniciar Metro ni Supabase salvo prueba contraria.

**Pendientes dentro de GAP-PKG-004:** comprobación independiente de `permission_granted`, atestación de conexión HTTP real desde ANIMA a QA, `attendance_policy` (incluyendo 42501) y batería de geocerca/asistencia. Antes de emplear `android_qa_set_location`, verificar el escenario canónico y su consentimiento; no inferir ausencia de `qa_geofence` a partir de búsquedas limitadas sobre un expediente que el lector MCP rechaza como `FILE_TOO_LARGE`. No ejecutar check-in, salida ni coordenadas inventadas. No cambiar requisitos históricos ni cerrar el paquete sin evidencias y aprobación explícita.
---

### Validación complementaria — permiso Android y controles ANIMA/QA (2026-10-19)

**Alcance:** continuidad de `GAP-PKG-004` sobre ANIMA Dev en emulador QEMU Android 17 y Supabase QA aislado. No se ejecutaron nuevos logins sintéticos ni se crearon registros de asistencia; no se modificaron archivos de la aplicación ni el esquema.

**Verificación independiente en Android:** tras la limpieza QA de la ejecución anterior, se recorrió visualmente Ajustes → Aplicaciones → ANIMA Dev → Permisos. En ese momento Location figuraba bajo `Not allowed`, con último acceso reportado a las 5:37. Ese estado posterior a la limpieza NO demuestra si el permiso se había otorgado correctamente durante la sesión sintética previa. Se seleccionó en Ajustes `Allow only while using the app`, con `Use precise location` activado. Captura de la pantalla de detalle: opción de uso en primer plano seleccionada y ubicación precisa habilitada; captura posterior de `App permissions`: `Location` figura bajo `Allowed`. **PASS del permiso vigente configurado en el emulador**, no certificación retroactiva de la herramienta `android_qa_allow_foreground_location` ni prueba de geocerca.

**Validaciones no destructivas de ANIMA:** `npm run typecheck` PASS (`tsc --noEmit --incremental false`); `npm run test` PASS con **54/54 pruebas** (`test:ci013`, pruebas de contrato/superficie). `git_status_unchanged:true` en la validación de tipos. Las pruebas de contrato no equivalen a un chequeo HTTP autenticado real ni certifican 42501.

**QA aislado comprobado:** `qa:isolated:viso` PASS: `QA_TARGET:VERIFIED`, `QA_REST_BINDING:PASS`, `QA_HTTP_AUTH:PASS`, `QA_MIGRATIONS:23`, `QA_SYNTHETIC_RESIDUAL_COUNTS:0|0|0|0`, `QA_WRITES:0`, `QA_HTTP_AUTHENTICATED_SCENARIOS:NOT_EXECUTED`. No se alteró producción ni se utilizaron claves de servicio en Android.

**Bloqueo del escenario HTTP autenticado:** `qa:isolated:viso:auth` está declarado en el package gate local y en `package.json`; inspección del ejecutor confirma tres escenarios que crean cuentas QA temporales, comprueban `has_permission` y limpian usuarios y fixtures. No obstante, `run_validations` lo rechazó con `CANONICAL_QUALITY_SCRIPT_TOOLCHAIN_NOT_ALLOWED`. **No se ejecutó el escenario**, por lo que este rechazo es del MCP y NO debe registrarse como FAIL de Supabase ni como PASS de los permisos o de `attendance_policy`.

**Lectura de `attendance_policy`:** el hook `src/hooks/use-attendance-policy.ts` exige sesión autenticada coincidente y evita la consulta anónima cuando no hay usuario/sesión. Conserva defaults si la consulta falla. Esta guardia se comprobó por inspección estática del código local; no acredita `GRANT SELECT`, RLS ni ausencia del error PostgreSQL `42501` bajo un usuario autenticado. Resolver privilegios solo tras prueba de rol y tabla en el QA aislado, nunca mediante un grant a `anon` o un bypass de RLS.

**Diagnóstico dentro de ANIMA:** la pantalla `app/anima-diagnostics.tsx` limita el acceso a un conjunto fijo de correos autorizados, por lo que no se debe relajar esa restricción para una cuenta sintética efímera ni presentar sus lecturas como realizadas. Sigue pendiente la atestación HTTP originada por ANIMA contra QA.

**Pendientes y continuidad:** certificar de forma gobernada la consulta autenticada a `public.attendance_policy` y descartar `42501`; confirmar la conexión HTTP in-app al backend aislado; localizar y validar el escenario/consentimiento de `qa_geofence` antes de realizar GPS, check-in o check-out. No inventar fixture, coordenadas, hashes ni aprobaciones. El paquete sigue `MATURATION_DRAFT`.
---

### GAP-PKG-004 — Autenticación HTTP y corrección de ejecutor QA v0.13.24 (2026-10-19)

**Alcance inalterado:** GAP-PKG-004 en `MATURATION_DRAFT`. Se mantiene Supabase QA aislado; no se aplicaron grants, políticas RLS, migraciones, permisos `anon`, cambios de producción ni fixtures persistentes. La ejecución de scripts con usuarios temporales sigue exigiendo autorización local independiente.

**Pruebas autenticadas reales usando `browser_qa_isolated_run` sobre VISO y Supabase QA:** `same_site`: PASS, HTTP 200, autenticación y acceso correctos en escritorio/tableta/móvil. `cross_site_global`: PASS, HTTP 200, autenticación y acceso global correctos en los tres viewports. `cross_site_site_only`: PASS_DENIED, HTTP 307 hacia pantalla de acceso denegado HTTP 200; la restricción entre sedes se conserva. Los tres escenarios confirmaron `qa_backend:ISOLATED_VERIFIED`, sesión JWT/cookie autenticada y `qa_synthetic_residue:0`; no prueban lectura de `attendance_policy` ni ausencia de 42501 en ANIMA.

**Defecto del ejecutor identificado:** el VSIX v0.13.23 rechaza la batería canónica `qa:isolated:viso:auth` con `CANONICAL_QUALITY_SCRIPT_TOOLCHAIN_NOT_ALLOWED` porque la gramática genérica para scripts `node` no incluye el subcomando `qa-auth`. Es rechazo anterior a toda ejecución; NO es fallo PostgreSQL ni autoriza a omitir controles.

**Corrección empaquetada v0.13.24 (pendiente instalación Windows):** excepción explícita y limitada a `GAP-PKG-004`, repo `vento-group-sas/vento-shell`, comando exacto `node scripts/quality/supabase-db-harness.mjs qa-auth` y prueba única declarada en el expediente local. Comprueba preflight y limpieza en el código fuente, huella de script antes/después del consentimiento, sesión `qa_synthetic` y `qa_privileged`, y exige **confirmación modal separada**, ejecución aislada de un único script y modo no detached. No habilita otros subcomandos, comandos arbitrarios, proyectos remotos, grants, operaciones fuera de QA ni aprobación automática por la sesión genérica.

**Batería local existente ampliada en `vento-shell` sin perder sus modificaciones previas:** se editaron directamente `scripts/quality/supabase-db-harness.mjs` y `scripts/quality/supabase-db-harness.test.mjs` mediante CAS/revisión. Tras `signInWithPassword` y validación RPC, cada uno de los tres usuarios sintéticos consulta mediante su sesión JWT la proyección real de diez columnas de `public.attendance_policy` utilizada por ANIMA. Un error SQLSTATE `42501` produce `QA_AUTH_ATTENDANCE_POLICY_42501`; un fallo distinto da `QA_AUTH_ATTENDANCE_POLICY_READ_FAILED`; ausencia/valor inválido da `QA_AUTH_ATTENDANCE_POLICY_ROW_INVALID`. La consulta se ejecuta antes de considerar PASS el escenario, preservando limpieza de BD y usuarios y auditoría de residuos. No se modificó el esquema ni se concedieron permisos.

**Validaciones ejecutadas:** test harness de Shell **26/26 PASS**, incluidas garantías estructurales del SELECT autenticado, la rama 42501 y limpieza; `qa:isolated:viso` **PASS**, 23 migraciones y conteos residuales `0|0|0|0`, `QA_WRITES:0`. VSIX v0.13.24: 375 entradas, 370 sin cambios, sintaxis correcta, ZIP/manifiesto válidos y **46/46 PASS en dos ejecuciones independientes sobre el paquete final**. Estas pruebas del VSIX son simuladas/locales y no equivalen a prueba instalada en Windows.

**Pendiente crítico:** instalar VSIX v0.13.24 en VS Code, recargar la extensión y ejecutar `run_validations` con SOLO `canonical_scripts:["qa:isolated:viso:auth"]` sobre `vento-shell`, `instance_id:GAP-PKG-004`, tras consentimiento separado. Verificar PASS o el código de error real, luego volver a pasar preflight sin residuos. Ante `42501` real, inspeccionar permisos de tabla/columna y RLS en el entorno QA antes de considerar cualquier cambio. La atestación HTTP originada dentro de ANIMA y geocerca siguen pendientes y no pueden darse por aprobadas automáticamente.
---

### Validación real v0.13.24 — QA autenticada y attendance_policy vacía (2026-10-19)

**Alcance:** continuidad exclusiva de `GAP-PKG-004` en el entorno Supabase QA aislado. La v0.13.24 quedó instalada y permitió `qa:isolated:viso:auth` bajo la sesión autorizada. No se modificaron Supabase, GRANT/RLS, migraciones, producción ni requisitos históricos.

**Primera ejecución auténtica:** preflight PASS (`QA_TARGET:VERIFIED`, `QA_HTTP_AUTH:PASS`, `QA_REST_BINDING:PASS`, 23 migraciones, residuos `0|0|0|0`, escrituras 0). La primera `qa:isolated:viso:auth` ejecutó el script, pero devolvió `QA_AUTH_ATTENDANCE_POLICY_ROW_INVALID`; no devolvió `42501`. La prueba recién añadida exigía una fila aunque el hook de ANIMA `src/hooks/use-attendance-policy.ts` contempla `.maybeSingle()` sin datos y recurre a `DEFAULT_POLICY`. El preflight inmediatamente posterior pasó con cero residuos: la limpieza del intento fallido funcionó.

**Corrección aplicada directamente sobre cambios locales preexistentes de Shell:** `scripts/quality/supabase-db-harness.mjs` ahora distingue `ROW_READ` de `EMPTY_TABLE_FALLBACK`. Cuando una consulta JWT a `public.attendance_policy` devuelve `null` sin error, comprueba mediante SQL de solo lectura `SELECT count(*) FROM public.attendance_policy` en el QA verificado. Si existen filas pero ninguna visible, falla con `QA_AUTH_ATTENDANCE_POLICY_ROW_NOT_VISIBLE`; si no existen, reconoce el fallback admitido por ANIMA. Conserva `QA_AUTH_ATTENDANCE_POLICY_42501` para errores SQLSTATE 42501 y limpieza verificada en todos los casos. `scripts/quality/supabase-db-harness.test.mjs` refuerza estas ramas. Ninguno de los archivos fue sustituido ni publicado en Git.

**Validación tras la corrección:** 26/26 pruebas unitarias del harness PASS. `qa:isolated:viso:auth` terminó PASS con `QA_AUTH_SESSION:PASS`, los tres escenarios `same_site`, `cross_site_global` y `cross_site_site_only` PASS y `QA_HTTP_AUTHENTICATED_SCENARIOS:3/3`. La consulta autenticada se efectuó con el JWT del actor sintético de cada escenario, sin error 42501, pero informó `QA_AUTH_ATTENDANCE_POLICY: EMPTY_TABLE_FALLBACK|EMPTY_TABLE_FALLBACK|EMPTY_TABLE_FALLBACK`. El SQL de verificación confirmó **cero filas en la tabla del QA aislado** durante esas consultas. `QA_SYNTHETIC_RESIDUE:0`. Un nuevo preflight posterior pasó: 23 migraciones, residuos `0|0|0|0`, escrituras 0.

**Límite estricto:** un SELECT autenticado exitoso con cero filas no demuestra que una fila de política real sea visible para ese actor bajo RLS. Tampoco demuestra tráfico HTTP originado por ANIMA ni prueba geocerca y asistencia. No insertar configuraciones inventadas ni alterar permisos de `anon` para forzar una prueba: cualquier fixture de política debe tener autorización canónica explícita y limpieza demostrada. El paquete continúa abierto en `MATURATION_DRAFT`, sin avance a otra tarea.
---

### GAP-PKG-004 — Escenario geocerca verificado y sondeo HTTP desde ANIMA Dev

**Alcance:** continuidad de `GAP-PKG-004` en `MATURATION_DRAFT`, con cambios exclusivamente locales en `vento-anima` y verificación de Supabase QA aislado. No se creó una tarea nueva, se alteraron requisitos históricos ni se aplicaron cambios a RLS, usuarios reales o producción.

**Rectificación documental basada en el expediente LOCAL vigente:** `git_diff_scoped` sobre `docs/plan-canonico/modular/package-gate-instances/GAP-PKG-004.json` mostró expresamente `qa_geofence` con `mode:"required"`, sede sintética `a` y parámetros declarados en el expediente. Las búsquedas de texto anteriores no encontraban ese campo porque el documento local supera el límite de lectura (`FILE_TOO_LARGE`) y el diff está truncado. **No registrar que falta un escenario de geocerca ni inventar coordenadas**: solo `android_qa_set_location` puede resolverlas con lectura y validación integral del contrato local. La existencia del escenario NO acredita que el GPS se haya aplicado ni que los eventos de asistencia se hayan ejecutado.

**Sondeo HTTP incorporado en el login ANIMA DEV:** se actualizó directamente `vento-anima/app/(auth)/login.tsx`, conservando los cambios preexistentes en `main`. El componente, solo bajo `__DEV__`, variante `development` y host de emulador `10.0.2.2`, realiza desde el runtime Android una petición de solo lectura `GET /auth/v1/health` hacia `EXPO_PUBLIC_SUPABASE_URL`, usando exclusivamente `EXPO_PUBLIC_SUPABASE_ANON_KEY`, límite de ocho segundos, cancelación al desmontar y validación de JSON con `name:"GoTrue"`. El pie QA distingue `comprobando`, `RESPONDIÓ` y `SIN RESPUESTA`. Un HTTP 200 de GoTrue prueba alcance del servicio Auth desde el cliente, pero NO autentica por sí solo la identidad del stack, un JWT, acceso PostgREST, RLS ni geocerca. No se registra ni expone una clave secreta.

**Validación de código:** `npm run typecheck` PASS y `npm run test` PASS (54/54). El cambio quedó guardado y revisado mediante CAS en la rama local `main`; no se ejecutó commit ni push de código. Pruebas de Supabase QA aislado: `qa:isolated:viso` PASS, `QA_TARGET:VERIFIED`, `QA_REST_BINDING:PASS`, `QA_HTTP_AUTH:PASS`, 23 migraciones, residuos sintéticos `0|0|0|0` y `QA_WRITES:0`.

**Bloqueos observados en Android 17:** una captura verificó que el permiso de ubicación de ANIMA Dev sigue bajo `Allowed` en Ajustes de Android. En la pantalla del launcher Expo figuró Metro `http://10.0.2.2:8082`, pero al intentar cargarlo apareció `Error loading app: timeout`. Logcat no mostró errores de app coincidentes. `android_qa_connect_metro` devolvió `ANDROID_QA_METRO_DEEPLINK_INVALID`; el intento de muestra GPS sintética `inside` fue rechazado con `ANDROID_OPERATION_IN_PROGRESS`. Ninguna de estas respuestas demuestra crash, backend equivocado, login fallido ni GPS aplicado. Se cerró únicamente el aviso de Expo; no se reinició Metro, se borraron datos ni se generaron identidades sintéticas.

**Continuidad autorizada:** recuperar primero la carga de bundle DEV sobre un Metro correctamente atestado, inspeccionar con `android_screenshot` el nuevo estado HTTP de GoTrue, y solo después ejecutar `android_qa_login` y la secuencia geocerca declarada (`inside`, `outside_first`, `outside_second`) con consentimiento GPS separado, observación visual, intervalo mínimo canónico y limpieza obligatoria. La lectura de una fila real de `attendance_policy` bajo RLS sigue pendiente porque la tabla QA tiene 0 filas; no crear una política no declarada para forzar PASS.
