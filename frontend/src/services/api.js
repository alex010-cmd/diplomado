// Capa de servicios: unico punto de comunicacion con el Backend.
// La sesion viaja en una cookie HttpOnly (credentials: 'include'):
// el token JWT NUNCA se guarda ni se lee desde JS/localStorage.
// En produccion el navegador usa el MISMO ORIGEN (/api, /images) y el
// nginx del front proxya al backend privado. No hay IPs por defecto.
const runtimeUrl = (typeof window !== 'undefined' && typeof window.__API_URL === 'string')
  ? window.__API_URL
  : undefined
export const API_URL = runtimeUrl !== undefined
  ? runtimeUrl
  : (import.meta.env.VITE_API_URL || '')
const API_BASE = API_URL.replace(/\/+$/, '')

// Las imagenes viven en disco del backend (/images/...), no en la DB:
// mismo origen si hay proxy, o contra API_BASE si se configuro una URL.
export const resolveImg = (image_url) => {
  if (!image_url) return ''
  if (/^https?:\/\//i.test(image_url)) return image_url
  if (image_url.startsWith('/')) return `${API_BASE}${image_url}`
  return image_url
}

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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

export const logoutRequest = () => req('/api/auth/logout', { method: 'POST' })

export const updateProfile = (data) =>
  req('/api/auth/me', { method: 'PATCH', body: data })
export const changePassword = (current_password, new_password) =>
  req('/api/auth/password', { method: 'POST', body: { current_password, new_password } })

export const fetchMe = () => req('/api/auth/me')
export const fetchUsers = () => req('/api/auth/users')

export const fetchAvailable = () => req('/api/products/available')
export const fetchProducts = () => req('/api/products')
export const createProduct = (data) =>
  req('/api/products', { method: 'POST', body: data })
export const updateProduct = (id, data) =>
  req(`/api/products/${id}`, { method: 'PATCH', body: data })
export const addStock = (product, qty) =>
  req(`/api/products/${product.id}/stock`, {
    method: 'PATCH', body: { stock: product.stock + qty }
  })

export const uploadProductImage = async (id, file) => {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API_BASE}/api/products/${id}/image`, {
    method: 'POST', credentials: 'include', body: fd
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'No se pudo subir la imagen')
  return data
}
export const fetchImageUsage = () => req('/api/images/usage')

export const checkout = (items, holder, pay_method) =>
  req('/api/sales/checkout', { method: 'POST', body: { items, holder, pay_method } })

export const cartPreview = (items) =>
  req('/api/cart/preview', { method: 'POST', body: { items } })

export const reserve = (holder, product_id, qty) =>
  req('/api/cart/reserve', { method: 'POST', body: { holder, product_id, qty } })
export const release = (holder, product_id, qty) =>
  req('/api/cart/release', { method: 'POST', body: { holder, product_id, qty } })
export const myCart = () => req('/api/cart/mine')
export const migrateCart = (from_holder) =>
  req('/api/cart/migrate', { method: 'POST', body: { from_holder } })

// Espejo local del carrito (el servidor es la verdad via reservas).
// Sirve para reintentar lo pendiente si la reserva expiro (30 min).
export const cartKey = (holder) => `cart:${holder}`
export const readMirror = (holder) => {
  try { return JSON.parse(localStorage.getItem(cartKey(holder)) || '{}') } catch { return {} }
}
export const writeMirror = (holder, cart) => {
  try { localStorage.setItem(cartKey(holder), JSON.stringify(cart)) } catch { /* lleno */ }
}

export const fetchSales = () => req('/api/sales')
export const fetchTicket = (saleId) => req(`/api/sales/${saleId}/ticket`)
export const fetchDashboard = () => req('/api/dashboard')

export const fetchLowStock = () => req('/api/low-stock')
export const fetchDepartments = () => req('/api/departments')
export const fetchDepartmentCounts = () => req('/api/departments/counts')
export const fetchDiscounts = () => req('/api/discounts')
export const setDiscount = (scope, target, percent) =>
  req('/api/discounts', { method: 'POST', body: { scope, target, percent } })
export const toggleDiscount = (id, active) =>
  req(`/api/discounts/${id}`, { method: 'PATCH', body: { active } })
export const deleteDiscount = (id) =>
  req(`/api/discounts/${id}`, { method: 'DELETE' })

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
