// Tarjetas guardadas SOLO EN MEMORIA (RAM del navegador).
// - JAMAS se envian al backend ni se guardan en la DB (el checkout solo
//   recibe el metodo de pago: efectivo / tarjeta_debito / tarjeta_credito).
// - JAMAS se guardan en localStorage/cookies: al recargar la pagina se borran.
// - Solo se conserva ultimos 4 digitos + marca para mostrar en el popup.
const memory = new Map() // key -> { last4, brand, holderName }

export function saveMemoryCard(key, { last4, brand, holderName }) {
  memory.set(key, { last4, brand, holderName, savedAt: new Date().toISOString() })
}

export function getMemoryCard(key) {
  return memory.get(key) || null
}

export function clearMemoryCard(key) {
  memory.delete(key)
}

export function detectBrand(digits) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^5[1-5]/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  return 'Tarjeta'
}
