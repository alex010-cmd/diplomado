import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { cartPreview, getHolder, myCart, readMirror, release, reserve, writeMirror } from '../services/api.js'

// Carrito GLOBAL: la misma logica de antes (reserva en DB, persistencia,
// espejo local) ahora vive en un solo lugar para poder abrir el carrito
// como popup desde el navbar en cualquier vista.
const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cart, setCart] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [preview, setPreview] = useState(null)
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const holder = getHolder(user)
  const canShop = !!user && user.role === 'cliente'
  const changeRef = useRef(null)

  // Carga inicial desde el servidor. El espejo NO se toca hasta terminar
  // (asi no se borra lo guardado al montar/navegar).
  useEffect(() => {
    if (!canShop) { setLoaded(false); return }
    let alive = true
    ;(async () => {
      try {
        const server = await myCart()
        const restored = {}
        for (const l of server) restored[l.product_id] = l.qty
        const mirror = readMirror(holder)
        for (const [pid, qty] of Object.entries(mirror)) {
          const id = Number(pid)
          const missing = (qty || 0) - (restored[id] || 0)
          if (missing > 0) {
            try {
              await reserve(holder, id, missing)
              restored[id] = (restored[id] || 0) + missing
            } catch { /* sin stock: se queda lo del servidor */ }
          }
        }
        if (alive) { setCart(restored); writeMirror(holder, restored); setLoaded(true) }
      } catch (e) {
        if (alive) { setCart(readMirror(holder)); setLoaded(true); setMsg(e.message) }
      }
    })()
    return () => { alive = false }
  }, [holder, canShop]) // eslint-disable-line

  // Espejo local solo despues de la carga inicial
  useEffect(() => { if (loaded) writeMirror(holder, cart) }, [JSON.stringify(cart), holder, loaded]) // eslint-disable-line

  const items = useMemo(() => Object.entries(cart).map(([pid, qty]) => ({
    product_id: Number(pid), qty
  })), [cart])

  // Ticket en vivo (sin vender)
  useEffect(() => {
    if (!items.length || !canShop) { setPreview(null); return }
    cartPreview(items).then(setPreview).catch(() => setPreview(null))
  }, [JSON.stringify(cart), canShop]) // eslint-disable-line

  const count = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart])
  const notify = () => { changeRef.current && changeRef.current() }

  const add = async (p) => {
    setMsg('')
    await reserve(holder, p.id, 1)
    setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))
    notify()
  }

  const dec = async (p) => {
    const q = cart[p.id] || 0
    if (!q) return
    await release(holder, p.id, 1)
    setCart((c) => {
      const n = { ...c }
      if ((n[p.id] || 0) <= 1) delete n[p.id]
      else n[p.id] -= 1
      return n
    })
    notify()
  }

  // Quitar por completo sin importar cuantos tenga
  const removeLine = async (p) => {
    await release(holder, p.id, null)
    setCart((c) => { const n = { ...c }; delete n[p.id]; return n })
    notify()
  }

  const clear = async () => {
    for (const pid of Object.keys(cart)) {
      try { await release(holder, Number(pid), null) } catch { /* sigue */ }
    }
    setCart({})
    notify()
  }

  const resetAfterPay = () => { setCart({}); notify() }

  const value = {
    cart, items, loaded, catalog, setCatalog, preview, msg, setMsg,
    open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false),
    add, dec, removeLine, clear, resetAfterPay, count, canShop,
    registerChange: (fn) => { changeRef.current = fn }
  }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
