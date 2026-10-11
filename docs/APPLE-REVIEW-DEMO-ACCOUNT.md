# Cuenta demo para revisión de Apple (Guideline 2.1)

Apple exige una cuenta de prueba que permita acceder a **todas** las funcionalidades de la app. Este documento asegura que la cuenta funcione de forma fiable.

---

## 1. Qué poner en App Store Connect

En **App Store Connect** → tu app **ANIMA** → **Información de la app** → **Información de la revisión de la app (beta)** (o "App Review Information" / "Beta App Review Information"):

| Campo     | Valor                  |
|----------|-------------------------|
| **Usuario** | `test@ventogroup.com` |
| **Contraseña** | `[credencial privada]`     |

- Escribe exactamente así (minúsculas, sin espacios).
- El revisor debe introducir su contrasena vigente; la app no almacena ni reemplaza contrasenas.

---

## 2. Verificar la cuenta en Supabase

La cuenta debe existir en **Supabase Auth** y tener datos en **employees** y **employee_sites**. Si no, tras el login la app quedará vacía y Apple rechazará.

### 2.1 Usuario en Auth

1. Supabase Dashboard → **Authentication** → **Users**.
2. Debe existir un usuario con email **test@ventogroup.com**.
3. Si no existe:
   - **Add user** → **Create new user**
   - Email: `test@ventogroup.com`
   - Password: `[credencial privada]`
   - Marcar **Auto Confirm User**.
   - Crear.

4. Si ya existe pero no recuerdas la contraseña: **Edit user** y cambia la contraseña a `[credencial privada]`.

### 2.2 Datos de empleado y sitios

Tras tener el usuario en Auth, hay que crear su fila en `employees` y en `employee_sites` para que la app muestre Home, check-in, documentos, etc.

1. En Supabase → **SQL Editor**, ejecuta el script:
   - `vento-anima/supabase/sql/2026-01-28_create_test_account.sql`
2. Ese script:
   - Busca un sitio activo (p. ej. "Vento Group").
   - Crea/actualiza la fila en `employees` para el usuario `test@ventogroup.com`.
   - Crea/actualiza la fila en `employee_sites` para que tenga al menos un sitio asignado.

Si el script falla con "Usuario no encontrado", crea primero el usuario en Auth (paso 2.1) y vuelve a ejecutarlo.

### 2.3 Sede para check-in desde cualquier lugar (revisores fuera de Cúcuta)

Los revisores de Apple/Google suelen estar en otro país, así que no pueden estar dentro del radio de tus sedes físicas. Para que puedan probar check-in y check-out **sin hacer otro build**:

1. En Supabase → **SQL Editor**, ejecuta:
   - `vento-anima/supabase/sql/2026-02-04_site_review_demo.sql`
2. Ese script:
   - Crea una sede **"App Review (Demo)"** sin coordenadas y con `type = 'vento_group'`.
   - La app la trata como "Esta sede no requiere GPS" y permite check-in desde cualquier ubicación.
   - El trigger del backend también ignora la validación de distancia para ese tipo de sede.
   - Asigna **solo** esa sede a la cuenta `test@ventogroup.com` (quita las sedes de Cúcuta para ese usuario).

Así la cuenta de revisión puede hacer check-in y check-out desde cualquier parte del mundo. No hace falta tocar código ni generar un nuevo build.

---

## 3. Build de produccion (EAS)

No incluir contrasenas de revision en variables EXPO_PUBLIC_, EAS ni codigo cliente.

Configurar la credencial vigente en Supabase Auth y proporcionarla por los canales privados de App Store Connect o Google Play Console.

La aplicacion no sustituye automaticamente la contrasena introducida.

## 4. Checklist antes de enviar a revisión

- [ ] En App Store Connect: Usuario `test@ventogroup.com`, Contraseña `[credencial privada]`.
- [ ] En Supabase Auth: existe el usuario `test@ventogroup.com` con contraseña `[credencial privada]` y está confirmado.
- [ ] Ejecutado `2026-01-28_create_test_account.sql` (existe fila en `employees` y `employee_sites` para ese usuario).
- [ ] Build sin contrasenas embebidas en variables EXPO_PUBLIC_.
- [ ] Probado localmente: login con `test@ventogroup.com` / `[credencial privada]`, entrar a Home, check-in, documentos, soporte, etc.

---

## 5. Si Apple sigue sin poder acceder

En la respuesta a Apple (Resolution Center), puedes incluir algo como:

> The demo account is:
> Username: test@ventogroup.com  
> Password: [credencial privada]  
>
> Please enter the username exactly as above (all lowercase). The app will accept this password for the review account. If you still cannot log in, please confirm you are using a stable internet connection and the latest build; we have verified this account successfully on our side.

Y comprobar de nuevo en Supabase que el usuario existe, está confirmado, y que el script SQL de la cuenta de prueba se ha ejecutado sin errores.

---

## 6. Por qué Apple sigue rechazando (y qué hacer)

Si ya tienes la cuenta en Auth, en employees, en employee_sites y las credenciales en App Store Connect, las causas más probables son:

### 6.1 Build antiguo o credenciales desactualizadas

Comprobar que Apple utiliza el build vigente y que la contrasena facilitada en App Store Connect coincide con la actual en Supabase Auth.

### 6.2 RLS (Row Level Security) en Supabase

Si en las tablas `employees` y `employee_sites` está activado RLS y no hay una política que permita al usuario autenticado leer **su propia fila**, la app hace login pero obtiene vacío y la pantalla queda incompleta. En el Dashboard ves los datos porque entras como admin; la app usa el JWT del usuario y puede estar siendo bloqueada.

**Qué hacer:**
1. Supabase → **Table Editor** → tabla `employees` → pestaña **Policies**.
2. Debe haber una política tipo “Users can read their own row” con condición `id = auth.uid()` (o equivalente) para `SELECT`. Si no existe, créala.
3. Igual en `employee_sites`: política que permita `SELECT` donde `employee_id = auth.uid()`.

Sin estas políticas, el usuario de revisión no verá su empleado ni sus sitios aunque las filas existan.

### 6.3 Contrasena en Auth no coincide

Restablecer la credencial de la cuenta de revision en Supabase Auth y actualizarla en el canal privado de App Store Connect. Nunca publicar ese valor en el repositorio.

### 6.4 Mensaje genérico de Apple

A veces Apple envía “we were unable to successfully access your app” por otros motivos (crash, pantalla en blanco, o que no probaron el último build). No siempre es un fallo de login.

**Qué hacer:**
Responde en el **Resolution Center** pidiendo detalles concretos y usando el texto de la sección 7 (en inglés). Así sabrás si el problema es login, pantalla en blanco o crash, y podrás corregirlo.

---

## 7. Mensaje para pegar en el Resolution Center (inglés)

Copia y pega esto (o adapta) al responder a Apple:

```
Thank you for your feedback.

We have updated the app and the demo account so that reviewers can access all features reliably. Please use the LATEST build when testing.

Demo account (please use exactly as shown):
• Username: test@ventogroup.com (all lowercase, no spaces)
• Password: [credencial privada] (provided privately in App Store Connect)

Steps:
1. Open the app and wait for the login screen.
2. Enter the username above in the email field.
3. Enter the password above in the password field.
4. Tap "Iniciar Sesión" (Sign In).
5. You should see the main screen with Check-in, History, Documents, Support, and News.

If you still cannot log in or see a blank screen after login, please tell us exactly what you see (e.g. error message, blank screen, crash) and confirm you are testing the latest build. We have verified this account works on our side with the current build.

Thank you.
```
