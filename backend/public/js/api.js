'use strict';

// Cliente HTTP con credenciales (cookies) y manejo uniforme de errores.
const API = {
  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (_e) {
      /* respuesta sin cuerpo JSON */
    }

    if (!res.ok) {
      const err = new Error((data && data.error) || 'Error de la solicitud');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
  get: (url) => API.request('GET', url),
  post: (url, body) => API.request('POST', url, body),
  patch: (url, body) => API.request('PATCH', url, body),
  put: (url, body) => API.request('PUT', url, body),
  del: (url) => API.request('DELETE', url),
};

// [E5.2: XSS] Escapa HTML al renderizar datos del servidor (nombres,
// descripciones). Obligatorio con cada innerHTML; lo vigila la regla SAST
// no-innerhtml-unescaped en tools/semgrep.yaml.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Toast de notificaciones.
function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + (type || 'info');
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

window.API = API;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
