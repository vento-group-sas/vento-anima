# Recordatorios y política de cierre de turnos — autoridad única

**Decisión funcional APROBADA; autocierre por geocerca PENDIENTE DE IMPLEMENTACIÓN Y CERTIFICACIÓN.** El cierre manual o automático deberá confirmarse mediante una transición atómica, idempotente y auditada del servidor, vinculada a una sesión exacta y su turno. ANIMA únicamente propone evidencia de salida; ni la ubicación del teléfono ni la notificación local constituyen por sí mismas un `check_out` confirmado.

`shift-runtime-processor` conserva recordatorios horarios, pero actualmente desactiva expresamente el autocierre por horario (`autoCloseEnabled = false`). Ninguna modificación de `shift_policy` puede activar un cierre temporal mientras esa condición siga vigente. La salida sostenida y validada de geocerca es el único desencadenante aprobado para solicitar un autocierre; los horarios sirven para recordar y abrir revisión, nunca para inventar una salida.

**Estado operativo actual:** cierre manual o administrativo autorizado. Hasta implementar y certificar la transición geográfica del servidor, ANIMA no debe anunciar un autocierre en funcionamiento.

## Contrato vigente de ubicación y permisos — GAP-PKG-004 (2026-10-21)

**Asistencia en primer plano:** ANIMA necesita sesión autenticada, GPS activado, ubicación precisa concedida *mientras se usa la app*, lectura reciente y geocerca válida para registrar entrada o salida. **El permiso de ubicación permanente/en segundo plano no es requisito del check-in ni del check-out.** En Android se rechaza ubicación aproximada cuando no permite validar precisión; en iOS se valida además la precisión efectiva de la muestra. Rechazar segundo plano no invalida una marcación autorizada.

**Seguimiento opcional del turno:** desde Ajustes, la persona puede consentir acceso en segundo plano para recibir advertencias por salida de sede. Este consentimiento se solicita de forma independiente, tras explicar finalidad y duración; no se solicita por defecto durante el check-in. Solo puede iniciar o reanudarse con turno abierto confirmado por servidor y permiso efectivo; debe detenerse ante salida confirmada o intención local de salida persistida pendiente de conciliación. Sin ese permiso, continúa siendo posible la asistencia en primer plano; no se asegura vigilancia ni aviso cuando la app esté suspendida.

**Declaración nativa frente a consentimiento:** las capacidades de segundo plano en `app.config.js` y en `android/app/src/main/AndroidManifest.xml` se conservan **exclusivamente para que el seguimiento opcional pueda funcionar**. Declarar `ACCESS_BACKGROUND_LOCATION`, servicio de ubicación Android o `UIBackgroundModes: location` no concede autorización al usuario ni convierte el seguimiento en obligatorio. Eliminarlas rompería la capacidad opcional; requeriría retirar primero esa función y revisar nuevamente Android/iOS. Cambios nativos necesitan build nueva y revisión de permisos/plataforma.

**Autocierre no habilitado:** las lecturas locales, el monitoreo opcional, las notificaciones y Play Integrity de la app/dispositivo **no certifican por sí solos la posición física ni generan `check_out`**. Cualquier autocierre futuro exige verificador geográfico independiente, transición exclusiva del servidor, control de carreras, idempotencia, pruebas adversariales y autorización expresa. El cierre manual/administrativo sigue disponible conforme a las reglas de asistencia.

**QA necesario para cerrar la fase:** comprobar Android/iOS con ubicación foreground precisa concedida y background denegado; foreground denegado/impreciso; consentimiento opcional y revocación posterior; reinicio durante turno; check-out confirmado y en cola durable; apagado de seguimiento sin sesión/turno; y cero autocierres a partir de GPS del cliente. Distinguir tests estáticos de validación real en dispositivo. Este contrato **no acredita por sí mismo** que la implementación ni GAP-PKG-004 hayan pasado sus gates.

## Aviso “X minutos antes” de la hora de salida

El aviso principal es **X minutos antes** de la hora programada de salida. Eso se controla con **`end_reminder_minutes_before_end`** en `shift_policy` (por defecto 5). Para que sea 10 minutos antes, basta con:

```sql
update shift_policy set end_reminder_minutes_before_end = 10 where id = 1;
```

No hace falta nueva build: la función lee ese valor cada vez que corre el cron (cada 5 min).

## Si no te llegó el aviso (diagnóstico desde la BD)

Cuando el aviso “X min antes” no llega, revisar en este orden:

1. **Que exista fila y esté activado el recordatorio**
   - `select id, end_reminder_enabled, end_reminder_minutes_before_end from shift_policy where id = 1;`
   - Debe haber una fila con `end_reminder_enabled = true`. Si no hay fila, crear/insertar una con esos valores.

2. **Minutos antes**
   - `end_reminder_minutes_before_end` debe ser 5 o 10 (o el valor que quieras). Si está en 0, el aviso se envía justo en la hora de salida.

3. **Token de push del empleado**
   - `select employee_id, token, is_active from employee_push_tokens where employee_id = '<tu_employee_id>';`
   - Tiene que haber al menos un token con `is_active = true`. Si no hay token, la app no puede recibir el push (revisar que en el dispositivo estén permitidas las notificaciones y que la app haya registrado el token).

4. **Cron activo**
   - El job que llama a la Edge Function debe ejecutarse cada 5 minutos (Supabase cron o equivalente). Si el cron no corre, no se envía ningún aviso.

5. **Qué pasó en ese turno**
   - `select * from shift_runtime_events where shift_id = '<shift_id>' and event_type = 'end_reminder_sent';`
   - Si aparece una fila con `status = 'applied'`, el sistema sí intentó enviar (revisar entonces token/notificaciones en el dispositivo). Si `status = 'skipped'` y `notes = 'no_active_tokens'`, el empleado no tenía token activo en ese momento.

6. **Zona horaria**
   - La función usa `America/Bogota` por defecto (o la env `SHIFT_RUNTIME_TIME_ZONE`). La “hora de salida” del turno se interpreta en esa zona; si el servidor o el cron usan otra hora, la ventana puede no coincidir.

## Tabla `shift_policy`

- **`end_reminder_enabled`** (boolean): si está en `true`, se envía el push “Tu turno está por cerrar” cuando corresponde.
- **`end_reminder_minutes_before_end`** (int): minutos **antes** de la hora de salida en que empieza la ventana del recordatorio (por defecto 5).
- **`end_reminder_minutes_after_end`** (int, opcional): ventana posterior al horario para el primer recordatorio; no es una ventana de cierre.
- **`auto_checkout_grace_minutes_after_end`** (int, legado): pese a su nombre, el procesador actual lo utiliza como demora del **recordatorio de seguimiento** después del fin programado (valor por defecto 30 minutos); no cierra asistencia.
- **`scheduled_auto_checkout_enabled`** (boolean, legado): actualmente ignorado para cierres por `shift-runtime-processor`, que fija `autoCloseEnabled = false`; activar esta columna no crea un `check_out`. No debe usarse como fuente de verdad para anunciar autocierre.

## Única autoridad de autocierre aprobada — contrato objetivo

1. **Evidencia:** durante una sesión laboral abierta, ANIMA observa posiciones sucesivas, válidas y precisas, inequívocamente fuera de la geocerca asociada al turno. La comprobación local actual requiere confirmación sostenida, no una muestra aislada. El cliente solo presenta una propuesta autenticada; no decide el cierre.
2. **Validación de servidor:** la autoridad deberá verificar identidad, sesión y turno exactos, revisión publicada, sede/punto físico, vigencia y orden temporal de muestras, calidad de GPS, exclusión de señales simuladas y ausencia de excepciones operativas autorizadas (p. ej. trabajo fuera de sede). No podrá aceptar como prueba definitiva campos suministrados únicamente por un cliente no confiable.
3. **Transición única:** solo el servidor podrá persistir el evento terminal mediante una operación atómica e idempotente. Concurrencia con salida manual, cola offline, segunda instancia del dispositivo o reintentos debe producir a lo sumo un cierre real y respuestas estables. El instante de cierre y su fundamento quedarán auditados; una observación tardía no podrá cerrar retroactivamente una sesión diferente.
4. **Sin evidencia concluyente:** ubicación imprecisa o simulada, ausencia de GPS, notificaciones desactivadas, falta de conectividad, turno en pausa, salida temporal justificada o jornada aún en trabajo externo **no producen autocierre**. Se genera, según política autorizada, un aviso o caso pendiente de revisión sin convertir la sospecha en horas certificadas.
5. **Horario:** `shift-runtime-processor` conserva únicamente recordatorios y seguimiento administrativo. El fin programado nunca constituye prueba automática de que el trabajador salió de la sede.
6. **Experiencia y privacidad:** el trabajador verá separado `turno abierto`, `salida propuesta`, `salida confirmada` y `caso pendiente`; la salida manual seguirá disponible. El seguimiento de ubicación termina con el cierre confirmado o con el evento local de salida durable sujeto a reconciliación, sin rastreo continuo fuera del turno.
7. **Aceptación obligatoria antes de habilitar:** pruebas QA de dos posiciones separadas, reentrada a geocerca, GPS simulado/impreciso, pausas y excepciones, dos dispositivos, carrera entre autocierre y salida manual, pérdida y recuperación de red, evento duplicado, turno nocturno, retiro de turno, auditoría y residuos sintéticos cero. No se habilitará producción por el éxito aislado de un GPS ADB.

**Implementación:** pendiente de transición y contrato de evidencia en el backend propietario. Hasta que existan y pasen esas pruebas, se mantiene el cierre manual o administrativo; no se ofrece autocierre ficticio.

## Cómo asegurar que el recordatorio llegue

1. **Que exista una fila en `shift_policy`** (normalmente `id = 1`).
2. **`end_reminder_enabled = true`**.
3. Opcional: aumentar **`end_reminder_minutes_before_end`** (ej. 10) para avisar antes, y **`end_reminder_minutes_after_end`** (ej. 15) para seguir enviando el recordatorio unos minutos después de la hora de salida (útil si el cron corre cada 5 min y se te pasó la hora).
4. El empleado debe tener al menos un token activo en **`employee_push_tokens`** (la app registra el token al permitir notificaciones).
5. El **cron** que llama a la Edge Function debe estar activo (cada 5 minutos); ver migración `20260314183000_anima_shift_runtime_processor_cron.sql`.

## Ejemplos de ajuste solo en BD (sin nueva build)

- **Aviso 10 minutos antes de la hora de salida:**  
  `update shift_policy set end_reminder_minutes_before_end = 10 where id = 1;`
- **Aviso 5 minutos antes** (valor por defecto):  
  `update shift_policy set end_reminder_minutes_before_end = 5 where id = 1;`
- Activar recordatorio (por si estaba en false):  
  `update shift_policy set end_reminder_enabled = true where id = 1;`
- Recordatorio hasta 15 min después de la hora de salida (por si se pasó la hora):  
  `update shift_policy set end_reminder_minutes_after_end = 15 where id = 1;`

Todo esto se aplica sin nueva build: la Edge Function lee `shift_policy` en cada ejecución.
