/**
 * Página web para crear/restablecer contraseña (ANIMA).
 * Modo invite: completa invitación laboral con staff-invitations-accept.
 * Modo recovery: recupera contraseña sin modificar permisos laborales.
 * No requiere instalar ni abrir la app en el dispositivo.
 *
 * Vercel: configurar SUPABASE_URL y SUPABASE_ANON_KEY en el proyecto.
 * Redirect URL en Supabase: https://tu-dominio.vercel.app/api/set-password
 */

const getHtml = (supabaseUrl, supabaseAnonKey) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Crear contraseña – ANIMA</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 16px; padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    h1 { font-size: 1.35rem; margin: 0 0 8px; color: #1a1a1a; }
    .sub { color: #666; font-size: 0.9rem; margin-bottom: 20px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #333; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #ddd; border-radius: 10px; font-size: 1rem; margin-bottom: 14px; }
    button { width: 100%; padding: 14px; background: #e2006a; color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #c0005a; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .msg { margin-top: 14px; padding: 12px; border-radius: 10px; font-size: 0.9rem; display: none; }
    .msg.success { background: #e8f5e9; color: #2e7d32; display: block; }
    .msg.error { background: #ffebee; color: #c62828; display: block; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="card">
    <div id="stateLoading">
      <h1>Crear contraseña</h1>
      <p class="sub">Validando enlace…</p>
    </div>
    <div id="stateInvalid" class="hidden">
      <h1>Enlace no válido</h1>
      <p class="sub">Este enlace ya se usó o venció. Solicita uno nuevo desde ANIMA o a quien te invitó.</p>
    </div>
    <div id="stateForm" class="hidden">
      <h1 id="formTitle">Crear contraseña</h1>
      <p class="sub" id="formDescription">Elige una contraseña para entrar a ANIMA (mínimo 8 caracteres).</p>
      <form id="form">
        <div id="inviteNameField" class="hidden">
          <label for="fullName">Nombre completo</label>
          <input id="fullName" name="fullName" type="text" autocomplete="name" maxlength="160" />
        </div>
        <label for="password">Nueva contraseña</label>
        <input type="password" id="password" name="password" minlength="8" placeholder="Mínimo 8 caracteres" required />
        <label for="confirm">Confirmar contraseña</label>
        <input type="password" id="confirm" name="confirm" minlength="8" placeholder="Repite la contraseña" required />
        <button type="submit" id="btn">Guardar contraseña</button>
      </form>
    </div>
    <div id="stateDone" class="hidden">
      <h1>Listo</h1>
      <p class="sub" id="doneDescription">Ya puedes cerrar esta página e iniciar sesión en la app ANIMA con tu correo y la contraseña que acabas de crear.</p>
    </div>
    <div id="msg" class="msg" role="alert"></div>
  </div>
  <script>
    window.SUPABASE_URL = ${JSON.stringify(supabaseUrl || "")};
    window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey || "")};
  </script>
  <script>
    (function() {
      var hash = (window.location.hash || "").slice(1);
      var hashParams = new URLSearchParams(hash);
      var queryParams = new URLSearchParams(window.location.search || "");
      var accessToken =
        hashParams.get("access_token") || queryParams.get("access_token");
      var refreshToken =
        hashParams.get("refresh_token") || queryParams.get("refresh_token");
      var code = queryParams.get("code");
      var tokenHash = queryParams.get("token_hash") || hashParams.get("token_hash");
      var verifyType = queryParams.get("type") || hashParams.get("type") || "recovery";
      var isInvitation = verifyType === "invite";

      var stateLoading = document.getElementById("stateLoading");
      var stateInvalid = document.getElementById("stateInvalid");
      var stateForm = document.getElementById("stateForm");
      var stateDone = document.getElementById("stateDone");
      var msg = document.getElementById("msg");
      var form = document.getElementById("form");
      var btn = document.getElementById("btn");
      var fullNameInput = document.getElementById("fullName");

      // Las invitaciones emitidas desde ANIMA movil y VISO web comparten Edge.
      // El navegador nunca decide el rol ni la sede del trabajador.
      if (isInvitation) {
        document.getElementById("formTitle").textContent = "Completa tu invitación";
        document.getElementById("formDescription").textContent =
          "Indica tu nombre y crea una contraseña. Tu acceso laboral se activará cuando se confirme tu invitación.";
        document.getElementById("inviteNameField").classList.remove("hidden");
        fullNameInput.required = true;
        document.getElementById("doneDescription").textContent =
          "Tu invitación fue aceptada y tu acceso laboral quedó activado. Ya puedes iniciar sesión en ANIMA.";
      }

      function showState(id) {
        [stateLoading, stateInvalid, stateForm, stateDone].forEach(function(el) { el.classList.add("hidden"); });
        document.getElementById(id).classList.remove("hidden");
        msg.className = "msg";
        msg.textContent = "";
        msg.style.display = "none";
      }
      function showError(text) {
        msg.className = "msg error";
        msg.textContent = text;
        msg.style.display = "block";
      }

      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY ||
          (verifyType !== "invite" && verifyType !== "recovery")) {
        showState("stateInvalid");
        return;
      }

      var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      var establishSession;
      var sessionReady = false;

      if (code) {
        establishSession = function() {
          return supabase.auth.exchangeCodeForSession(code);
        };
      } else if (tokenHash) {
        establishSession = function() {
          return supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: verifyType,
          });
        };
      } else if (accessToken && refreshToken) {
        establishSession = function() {
          return supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        };
      } else {
        showState("stateInvalid");
        return;
      }

      function ensureSession() {
        if (sessionReady) return Promise.resolve();
        return establishSession().then(function(res) {
          if (res && res.error) throw res.error;
          return supabase.auth.getSession();
        }).then(function(res) {
          if (res && res.error) throw res.error;
          if (!res || !res.data || !res.data.session || !res.data.session.access_token) {
            throw new Error("El enlace no estableció una sesión válida.");
          }
          sessionReady = true;
        });
      }

      function acceptStaffInvitation(password, fullName) {
        // La Edge autoriza al usuario a partir de su sesion Auth y consulta
        // rol/sede del registro canonico. Nunca enviar service_role al navegador.
        return supabase.functions.invoke("staff-invitations-accept", {
          body: { password: password, full_name: fullName }
        }).then(async function(res) {
          if (res && res.error) {
            var detail = "No se pudo activar el acceso laboral.";
            var context = res.error.context;
            if (context && typeof context.clone === "function") {
              try {
                var payload = await context.clone().json();
                if (payload && typeof payload.error === "string") detail = payload.error;
              } catch (_) {
                // Una respuesta no JSON nunca autoriza mostrar exito.
              }
            }
            throw new Error(detail);
          }
          if (!res || !res.data || res.data.error || !res.data.user_id) {
            throw new Error("La invitación no quedó confirmada.");
          }
        });
      }

      // Importante: no validar/consumir el token al cargar para evitar que
      // prefetch de correo invalide el enlace antes de que el usuario lo use.
      showState("stateForm");

      form.addEventListener("submit", function(e) {
        e.preventDefault();
        var pwd = document.getElementById("password").value;
        var conf = document.getElementById("confirm").value;
        if (pwd.length < 8) {
          showError("La contraseña debe tener al menos 8 caracteres.");
          return;
        }
        if (pwd !== conf) {
          showError("Las contraseñas no coinciden.");
          return;
        }
        var fullName = isInvitation ? fullNameInput.value.trim() : "";
        if (isInvitation && fullName.length < 2) {
          showError("Indica tu nombre completo para aceptar la invitación.");
          return;
        }
        btn.disabled = true;
        ensureSession()
          .then(function() {
            if (isInvitation) {
              // Solo la Edge puede guardar las credenciales y activar el
              // empleo en PostgreSQL. Auth por si solo no equivale a exito.
              return acceptStaffInvitation(pwd, fullName);
            }
            return supabase.auth.updateUser({ password: pwd }).then(function(res) {
              if (res && res.error) throw res.error;
            });
          })
          .then(function() {
            showState("stateDone");
          })
          .catch(function(err) {
            btn.disabled = false;
            var raw = (err && err.message ? String(err.message) : "").toLowerCase();
            if (raw.includes("expired") || raw.includes("invalid") ||
                raw.includes("no longer available") ||
                raw.includes("valid invitation required")) {
              showState("stateInvalid");
              return;
            }
            if (isInvitation) {
              showError("La invitación no se pudo completar. Reintenta sin cerrar esta página. " +
                (raw.includes("activation failed") ? "El acceso laboral no está activo." : ""));
              return;
            }
            showError(err.message || "No se pudo guardar la contraseña.");
          });
      });
    })();
  </script>
</body>
</html>`;

module.exports = (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(getHtml(supabaseUrl, supabaseAnonKey));
};
