// Cliente de la API: todas las pantallas hablan con el back a través de TH.api().
// Requiere js/config.js cargado antes. La sesión (TH.session) la define js/app.js.
(function () {
  const TH = (window.TH = window.TH || {});
  const BASE_URL = (window.TH_CONFIG && window.TH_CONFIG.API_URL) || 'http://localhost:8080/api/v1';
  const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

  // El JWT viaja en una cookie HttpOnly que JavaScript no puede leer; el navegador la manda solo.
  // Para POST/PUT/PATCH/DELETE el back exige además el token CSRF: viene en la cookie XSRF-TOKEN
  // (esa sí es legible) y se reenvía en el header X-XSRF-TOKEN.
  function readCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // El back responde los errores con { title, detail, errors? } (formato ProblemDetail).
  function messageFrom(status, problem) {
    if (status === 0) return 'No se pudo conectar con el servidor. Revisa que el back esté encendido.';
    if (problem && problem.errors) return Object.values(problem.errors).join(' ');
    if (problem && problem.detail) return problem.detail;
    return 'Ocurrió un error inesperado (' + status + ').';
  }

  /** Error de la API: trae el status HTTP y un mensaje listo para mostrarle al usuario. */
  class ApiError extends Error {
    constructor(status, problem) {
      super(messageFrom(status, problem));
      this.status = status;
      this.problem = problem;
    }
  }
  TH.ApiError = ApiError;

  /**
   * fetch con la URL base, la cookie de sesión y el token CSRF ya puestos.
   *   TH.api('/auth/me')
   *   TH.api('/auth/login', { method: 'POST', body: { ... }, auth: false })
   */
  TH.api = async function (path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (!SAFE_METHODS.includes(method.toUpperCase())) {
      const csrf = readCookie('XSRF-TOKEN');
      if (csrf) headers['X-XSRF-TOKEN'] = csrf;
    }
    const session = TH.session && TH.session.get();

    let response;
    try {
      response = await fetch(BASE_URL + path, {
        method,
        headers,
        credentials: 'include', // manda y recibe las cookies aunque la API esté en otro puerto
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError(0, null); // sin red, back apagado o bloqueado por CORS
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      // token vencido, alterado o usuario desactivado: se cierra la sesión local
      if (response.status === 401 && auth && session) {
        TH.session.clear();
        location.href = 'login.html';
      }
      throw new ApiError(response.status, data);
    }
    return data;
  };

  TH.auth = {
    login: (email, password) =>
      TH.api('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
    register: (name, email, password) =>
      TH.api('/auth/register', { method: 'POST', body: { name, email, password }, auth: false }),
    me: () => TH.api('/auth/me'),
    logout: () => TH.api('/auth/logout', { method: 'POST', auth: false }),
  };
})();
