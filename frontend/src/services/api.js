// Capa de servicios: unico punto de comunicacion con el Backend (VPC Backend).
// En produccion VITE_API_URL = IP privada del backend (peering) o dominio HTTPS.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function loginRequest(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (res.status === 429) throw new Error('IP bloqueada temporalmente por demasiados intentos.')
  if (!res.ok) throw new Error('Credenciales invalidas')
  return res.json()
}

export async function fetchDashboard(token) {
  const res = await fetch(`${API_URL}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.status === 401) throw new Error('Sesion expirada. Inicia sesion de nuevo.')
  if (!res.ok) throw new Error('No se pudo cargar el dashboard')
  return res.json()
}
