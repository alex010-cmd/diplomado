import React, { createContext, useContext, useMemo, useState } from 'react'
import { getHolder, loginRequest, migrateCart, registerRequest } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('jwt') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })

  const save = (data) => {
    setToken(data.access_token)
    const u = { username: data.username, full_name: data.full_name,
                role: data.role, first_purchase_done: data.first_purchase_done,
                email: data.email || '' }
    setUser(u)
    localStorage.setItem('jwt', data.access_token)
    localStorage.setItem('user', JSON.stringify(u))
  }

  const value = useMemo(() => ({
    token, user,
    isAuth: Boolean(token),
    async login(username, password) {
      const guest = getHolder(null)
      const data = await loginRequest(username, password)
      save(data)
      if (data.role === 'cliente') {
        try { await migrateCart(data.access_token, guest) } catch { /* nada que mover */ }
      }
    },
    async register(username, password, full_name, email) {
      const guest = getHolder(null)
      const data = await registerRequest(username, password, full_name, email)
      save(data)
      try { await migrateCart(data.access_token, guest) } catch { /* nada que mover */ }
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
    logout() {
      setToken(''); setUser(null)
      localStorage.removeItem('jwt'); localStorage.removeItem('user')
    }
  }), [token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
