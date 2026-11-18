// Sesión, permisos por rol y utilidades compartidas de todas las pantallas (objeto global TH).
// Orden de carga en cada página: tailwind-config.js, config.js, api.js, app.js
//
// Convenciones del HTML que este archivo entiende:
//   <body data-access="USER ADMIN">      roles que pueden ver la pantalla (si el rol no está, redirige al inicio)
//   data-roles="AGENT ADMIN"             muestra ese elemento solo a esos roles (menú lateral)
//   data-user-name / -initials / -email  se llenan con los datos de la sesión
//   data-role-label                      se llena con el nombre del rol
(function () {
  const TH = (window.TH = window.TH || {});

  const STORAGE_KEY = 'th-session';
  const PUBLIC_PAGES = ['login.html', 'registro.html', 'index.html', ''];
  const ROLE_LABELS = { USER: 'Solicitante', LIBERADOR: 'Liberador', AGENT: 'Agente', ADMIN: 'Administrador' };

  const currentPage = () => location.pathname.split('/').pop();
  const isPublicPage = () => PUBLIC_PAGES.includes(currentPage());

  // ---------- Sesión ----------
  // El JWT vive en una cookie HttpOnly: este archivo nunca lo ve. En localStorage solo se guardan
  // los datos para pintar la pantalla (nombre, rol, vencimiento), que no sirven para autenticarse.
  // Quien decide si la sesión vale es siempre el back (/auth/me y el 401 de TH.api).
  function toUser(auth) {
    return { id: auth.id, name: auth.name, email: auth.email, role: auth.role };
  }

  TH.session = {
    get() {
      try {
        const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!session || !session.user || !session.expiresAt) return null;
        if (Date.parse(session.expiresAt) <= Date.now()) {
          this.clear();
          return null;
        }
        return session;
      } catch (e) {
        return null;
      }
    },
    /** Recibe el AuthResponse del back: { id, name, email, role, expiresAt }. */
    save(auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: toUser(auth), expiresAt: auth.expiresAt }));
    },
    updateUser(auth) {
      if (this.get()) this.save(auth);
    },
    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        /* sin storage disponible */
      }
    },
  };

  // Por ahora todos los roles entran al dashboard. Cuando existan las demás pantallas,
  // aquí se decide a dónde manda cada rol (por ejemplo USER -> mis-tickets.html).
  TH.homeFor = function (role) {
    return 'dashboard.html';
  };

  // La cookie HttpOnly solo la puede borrar el back; aunque falle la llamada se limpia lo local.
  TH.logout = async function () {
    try {
      if (TH.auth) await TH.auth.logout();
    } catch (e) {
      /* sin red o sesión ya vencida: igual se sale */
    }
    TH.session.clear();
    location.href = 'login.html';
  };

  TH.roleLabel = (role) => ROLE_LABELS[role] || role;

  TH.initials = function (name) {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  };

  /** Aviso flotante abajo a la derecha. */
  TH.toast = function (message, icon = 'check_circle') {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.className =
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-inverse-surface text-inverse-on-surface ' +
      'px-4 py-3 rounded-lg shadow-lg font-body-md text-body-md';
    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-outlined text-[20px]';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.textContent = message;
    el.append(iconEl, textEl);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  // ---------- Pintar datos de la sesión en la pantalla ----------
  function fill(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      if ('value' in el) el.value = value;
      else el.textContent = value;
    });
  }

  function applyUser(user) {
    fill('[data-user-name]', user.name);
    fill('[data-user-initials]', TH.initials(user.name));
    fill('[data-user-email]', user.email);
    fill('[data-role-label]', TH.roleLabel(user.role));
  }

  function applyRole(role) {
    document.querySelectorAll('[data-roles]').forEach((el) => {
      el.hidden = !el.dataset.roles.split(/\s+/).includes(role);
    });
    // el selector "vista previa de rol" era solo de maqueta: ahora el rol viene de la sesión
    document.querySelectorAll('[data-demo="role-preview"]').forEach((el) => el.remove());
  }

  // ---------- Quién puede ver qué pantalla ----------
  const session = TH.session.get();

  if (isPublicPage()) {
    if (session) {
      location.replace(TH.homeFor(session.user.role)); // ya inició sesión: no necesita ver el login
    } else if (['', 'index.html'].includes(currentPage())) {
      location.replace('login.html');
    }
    return;
  }

  if (!session) {
    location.replace('login.html');
    return;
  }

  // pantalla protegida: se oculta hasta confirmar que el rol tiene acceso (evita ver contenido ajeno un instante)
  document.documentElement.style.visibility = 'hidden';

  document.addEventListener('DOMContentLoaded', function () {
    const user = session.user;
    const allowed = (document.body.dataset.access || '').split(/\s+/).filter(Boolean);
    if (allowed.length && !allowed.includes(user.role)) {
      location.replace(TH.homeFor(user.role));
      return;
    }

    applyRole(user.role);
    applyUser(user);
    document.querySelectorAll('[data-logout], aside a[href="login.html"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        TH.logout();
      });
    });
    document.documentElement.style.visibility = '';

    // confirma con el back que la sesión sigue viva (si no, TH.api cierra la sesión y manda al login)
    if (TH.auth) {
      TH.auth
        .me()
        .then((fresh) => {
          TH.session.updateUser(fresh);
          applyRole(fresh.role);
          applyUser(fresh);
        })
        .catch(() => {});
    }
  });
})();
