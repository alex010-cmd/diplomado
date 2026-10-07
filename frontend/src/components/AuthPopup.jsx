import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// Popup "Para comprar necesitas una cuenta": formulario iniciar sesion
// con enlace a crear cuenta. Mismo estilo que los demas popups.
export function AuthPopup({ onClose, onSuccess, initial = 'login' }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initial)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'login') await login(username, password)
      else await register(username, password, fullName, email)
      onSuccess && onSuccess()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <button type="button" className="auth-x" title="Cerrar" onClick={onClose}>X</button>
        <h3>Para comprar necesitas una cuenta</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className={mode === 'login' ? 'chip-on' : 'chip'}
                  onClick={() => { setMode('login'); setError('') }}>Iniciar sesion</button>
          <button className={mode === 'register' ? 'chip-on' : 'chip'}
                  onClick={() => { setMode('register'); setError('') }}>Crear cuenta</button>
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
          <label>Usuario<input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
          {mode === 'register' && (
            <>
              <label>Nombre completo<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
              <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            </>
          )}
          <label>Contrasena{mode === 'register' ? ' (min 6)' : ''}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p className="err">{error}</p>}
          <button className="btn-primary" disabled={loading}>
            {loading ? 'Verificando...' : mode === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
          </button>
        </form>
        {mode === 'register' && <p className="ok">Tu primera compra lleva 15% de descuento.</p>}
      </div>
    </div>
  )
}
