// Ajustes del front. Para apuntar a otro entorno (por ejemplo Railway) solo cambia API_URL.
// En local abre el front como http://localhost:5500 (no 127.0.0.1): la cookie de sesión es
// SameSite=Strict y el navegador solo la manda si el front y la API comparten el mismo host.
window.TH_CONFIG = {
  API_URL: 'http://localhost:8080/api/v1',
};
