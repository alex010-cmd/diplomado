import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function Login({ go }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Admin123*')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await login(username, password) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={s.wrap}>
      <form onSubmit={onSubmit} style={s.card}>
        <h2>Acceso seguro</h2>
        <p style={s.sub}>Frontend (VPC Frontend) + JWT + HTTPS</p>
        <label>Usuario<input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Contrasena<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div style={s.err}>{error}</div>}
        <button disabled={loading}>{loading ? 'Verificando...' : 'Iniciar sesion'}</button>
        <small>Demo admin: admin / Admin123*</small>
        <small><button type="button" onClick={() => go('tienda')}>Ver tienda sin cuenta</button></small>
        <small>¿Cliente nuevo? <button type="button" onClick={() => go('register')}>Registrarse</button></small>
      </form>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a' },
  card: { background: '#fff', padding: 28, borderRadius: 14, display: 'grid', gap: 12, width: 320 },
  sub: { color: '#64748b', marginTop: -10 },
  err: { background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 8 }
}
