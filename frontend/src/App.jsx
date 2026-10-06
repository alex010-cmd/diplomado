import React from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { Login } from './pages/Login.jsx'
import { Dashboard } from './pages/Dashboard.jsx'

function Shell() {
  const { isAuth } = useAuth()
  return isAuth ? <Dashboard /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
