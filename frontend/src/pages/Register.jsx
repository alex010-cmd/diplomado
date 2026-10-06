import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// Registro publico de clientes: habilita 15% en su primera compra.
export function Register({ go }) {
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await register(username, password, fullName, email) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={s.wrap}>
      <form onSubmit={onSubmit} style={s.card}>
        <h2>Crear cuenta de cliente</h2>
        <p style={s.sub}>Tu primera compra lleva 15% de descuento.</p>
        <label>Usuario<input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Nombre completo<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
        <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Contrasena (min 6)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div style={s.err}>{error}</div>}
        <button disabled={loading}>{loading ? 'Creando...' : 'Registrarse'}</button>
        <small><button type="button" onClick={() => go('login')}>Ya tengo cuenta</button></small>
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
