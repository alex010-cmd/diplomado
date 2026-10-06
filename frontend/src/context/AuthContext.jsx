import React, { createContext, useContext, useMemo, useState } from 'react'
import { loginRequest, registerRequest } from '../services/api.js'

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
    async login(username, password) { save(await loginRequest(username, password)) },
    async register(username, password, full_name, email) {
      save(await registerRequest(username, password, full_name, email))
    },
    markFirstPurchaseDone() {
      setUser((u) => {
        const nu = { ...u, first_purchase_done: true }
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
