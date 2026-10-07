import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, getHolder, loginRequest, logoutRequest, migrateCart, registerRequest } from '../services/api.js'

const AuthContext = createContext(null)

const cleanUser = (u) => ({
  username: u.username, full_name: u.full_name, role: u.role,
  first_purchase_done: u.first_purchase_done, email: u.email || ''
})

// La sesion real vive en una cookie HttpOnly emitida por el backend.
// Aqui solo se guarda el PERFIL (no secreto) para pintar la UI;
// NUNCA se almacena el JWT (ni localStorage ni sessionStorage).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })

  const persist = (u) => {
    const clean = cleanUser(u)
    localStorage.setItem('user', JSON.stringify(clean))
    return clean
  }

  // Al montar: si habia perfil guardado, validar la cookie con /auth/me.
  // Si la cookie expiro o no existe, se limpia el perfil.
  useEffect(() => {
    if (!localStorage.getItem('user')) return
    let alive = true
    fetchMe()
      .then((me) => { if (alive) setUser(persist(me)) })
      .catch(() => {
        if (alive) { localStorage.removeItem('user'); setUser(null) }
      })
    return () => { alive = false }
  }, [])

  const value = useMemo(() => ({
    user,
    isAuth: Boolean(user),
    async login(username, password) {
      const guest = getHolder(null)
      const data = await loginRequest(username, password)
      setUser(persist(data))
      if (data.role === 'cliente') {
        try { await migrateCart(guest) } catch { /* nada que mover */ }
      }
    },
    async register(username, password, full_name, email) {
      const guest = getHolder(null)
      const data = await registerRequest(username, password, full_name, email)
      setUser(persist(data))
      try { await migrateCart(guest) } catch { /* nada que mover */ }
    },
    markFirstPurchaseDone() {
      setUser((u) => {
        const nu = { ...u, first_purchase_done: true }
        localStorage.setItem('user', JSON.stringify(nu))
        return nu
      })
    },
    updateUser(patch) {
      setUser((u) => {
        const nu = { ...u, ...patch }
        localStorage.setItem('user', JSON.stringify(nu))
        return nu
      })
    },
    async logout() {
      try { await logoutRequest() } catch { /* la cookie se limpia igual */ }
      setUser(null)
      localStorage.removeItem('user')
    }
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
