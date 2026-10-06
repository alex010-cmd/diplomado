import React, { createContext, useContext, useMemo, useState } from 'react'
import { loginRequest } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('jwt') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })

  const value = useMemo(() => ({
    token, user,
    isAuth: Boolean(token),
    async login(username, password) {
      const data = await loginRequest(username, password)
      setToken(data.access_token)
      const u = { username: data.username, full_name: data.full_name, role: data.role }
      setUser(u)
      localStorage.setItem('jwt', data.access_token)
      localStorage.setItem('user', JSON.stringify(u))
    },
    logout() {
      setToken(''); setUser(null)
      localStorage.removeItem('jwt'); localStorage.removeItem('user')
    }
  }), [token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
