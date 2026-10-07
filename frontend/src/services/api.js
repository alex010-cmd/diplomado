// Capa de servicios: unico punto de comunicacion con el Backend.
// En produccion VITE_API_URL = IP privada del backend (peering) o dominio.
// Prioridad: 1) /env.js generado al arrancar (BACKEND_URL, sin rebuild),
// 2) VITE_API_URL de build, 3) localhost (dev).
export const API_URL =
  (typeof window !== 'undefined' && window.__API_URL) ||
  import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Las imagenes viven en disco del backend (/images/...), no en la DB.
// Esta funcion resuelve rutas relativas contra el backend.
export const resolveImg = (image_url) => {
  if (!image_url) return ''
  if (/^https?:\/\//i.test(image_url)) return image_url
  if (image_url.startsWith('/')) return `${API_URL}${image_url}`
  return image_url
}

const authH = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
})

async function req(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: authH(token),
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 429) throw new Error('IP bloqueada temporalmente por demasiados intentos.')
  if (res.status === 401) throw new Error(data.detail || 'No autorizado. Inicia sesion de nuevo.')
  if (!res.ok) throw new Error(`(${res.status}) ${data.detail || 'Error en la operacion'}`)
  return data
}

export const loginRequest = (u, p) =>
  req('/api/auth/login', { method: 'POST', body: { username: u, password: p } })

export const registerRequest = (u, p, full_name, email) =>
  req('/api/auth/register', { method: 'POST', body: { username: u, password: p, full_name, email } })

export const updateProfile = (token, data) =>
  req('/api/auth/me', { method: 'PATCH', body: data, token })
export const changePassword = (token, current_password, new_password) =>
  req('/api/auth/password', { method: 'POST', body: { current_password, new_password }, token })

export const fetchMe = (token) => req('/api/auth/me', { token })
export const fetchUsers = (token) => req('/api/auth/users', { token })

export const fetchAvailable = () => req('/api/products/available')
export const fetchProducts = (token) => req('/api/products', { token })
export const createProduct = (token, data) =>
  req('/api/products', { method: 'POST', body: data, token })
// Reabasto admin: fija stock final = actual + cantidad (sin limite)
export const addStock = (token, product, qty) =>
  req(`/api/products/${product.id}/stock`, {
    method: 'PATCH', body: { stock: product.stock + qty }, token
  })
export const updateProduct = (token, id, data) =>
  req(`/api/products/${id}`, { method: 'PATCH', body: data, token })

export const uploadProductImage = async (token, id, file) => {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API_URL}/api/products/${id}/image`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'No se pudo subir la imagen')
  return data
}
export const fetchImageUsage = (token) =>
  req('/api/images/usage', { token })

export const checkout = (items, token, holder, pay_method) =>
  req('/api/sales/checkout', { method: 'POST', body: { items, holder, pay_method }, token })

export const cartPreview = (items, token) =>
  req('/api/cart/preview', { method: 'POST', body: { items }, token })

export const reserve = (holder, product_id, qty, token) =>
  req('/api/cart/reserve', { method: 'POST', body: { holder, product_id, qty }, token })
export const release = (holder, product_id, qty, token) =>
  req('/api/cart/release', { method: 'POST', body: { holder, product_id, qty }, token })
export const myCart = (token) => req('/api/cart/mine', { token })
export const migrateCart = (token, from_holder) =>
  req('/api/cart/migrate', { method: 'POST', body: { from_holder }, token })

// Espejo local del carrito (el servidor es la verdad via reservas).
// Sirve para reintentar lo pendiente si la reserva expiro (30 min).
export const cartKey = (holder) => `cart:${holder}`
export const readMirror = (holder) => {
  try { return JSON.parse(localStorage.getItem(cartKey(holder)) || '{}') } catch { return {} }
}
export const writeMirror = (holder, cart) => {
  try { localStorage.setItem(cartKey(holder), JSON.stringify(cart)) } catch { /* lleno */ }
}

export const fetchSales = (token) => req('/api/sales', { token })
export const fetchTicket = (token, saleId) => req(`/api/sales/${saleId}/ticket`, { token })
export const fetchDashboard = (token) => req('/api/dashboard', { token })

export const fetchLowStock = (token) => req('/api/low-stock', { token })
export const fetchDepartments = (token) => req('/api/departments', { token })
export const fetchDepartmentCounts = (token) => req('/api/departments/counts', { token })
export const fetchDiscounts = (token) => req('/api/discounts', { token })
export const setDiscount = (token, scope, target, percent) =>
  req('/api/discounts', { method: 'POST', body: { scope, target, percent }, token })
export const toggleDiscount = (token, id, active) =>
  req(`/api/discounts/${id}`, { method: 'PATCH', body: { active }, token })
export const deleteDiscount = (token, id) =>
  req(`/api/discounts/${id}`, { method: 'DELETE', token })

// Identificador del carrito: estable por usuario, aleatorio para invitado.
// Las reservas de stock en la DB se ligan a este holder.
export function getHolder(user) {
  if (user) return `u:${user.username}`
  let g = localStorage.getItem('guest_holder')
  if (!g) {
    g = `g:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    localStorage.setItem('guest_holder', g)
  }
  return g
}

