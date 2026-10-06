import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { changePassword, fetchMe, updateProfile } from '../services/api.js'

// Engrane: cambiar correo, contrasena y direccion de entrega.
export function Settings() {
  const { token } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', address: '' })
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [msg, setMsg] = useState('')
  const [emsg, setEmsg] = useState('')

  const load = async () => {
    const me = await fetchMe(token)
    setForm({ full_name: me.full_name || '', email: me.email || '', address: me.address || '' })
  }
  React.useEffect(() => { load().catch((e) => setEmsg(e.message)) }, [])

  const save = async (e) => {
    e.preventDefault(); setEmsg(''); setMsg('')
    try {
      await updateProfile(token, form)
      setMsg('Perfil actualizado (nombre, correo y direccion de entrega).')
    } catch (e2) { setEmsg(e2.message) }
  }

  const savePw = async (e) => {
    e.preventDefault(); setEmsg(''); setMsg('')
    try {
      await changePassword(token, pw.current_password, pw.new_password)
      setMsg('Contrasena actualizada.')
      setPw({ current_password: '', new_password: '' })
    } catch (e2) { setEmsg(e2.message) }
  }

  return (
    <div style={s.wrap}>
      <h2>Ajustes de cuenta</h2>
      {emsg && <p style={s.err}>{emsg}</p>}
      {msg && <p style={s.ok}>{msg}</p>}
      <form onSubmit={save} style={s.card}>
        <h3>Perfil</h3>
        <label>Nombre completo<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
        <label>Correo<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Direccion de entrega<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, numero, colonia, ciudad" /></label>
        <button>Guardar cambios</button>
      </form>
      <form onSubmit={savePw} style={s.card}>
        <h3>Cambiar contrasena</h3>
        <label>Actual<input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></label>
        <label>Nueva (min 6)<input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></label>
        <button>Actualizar contrasena</button>
      </form>
    </div>
  )
}

const s = {
  wrap: { padding: 24, background: '#f1f5f9', minHeight: '100vh', display: 'grid', gap: 12, alignContent: 'start' },
  card: { background: '#fff', padding: 20, borderRadius: 12, display: 'grid', gap: 10, maxWidth: 420 },
  err: { background: '#fee2e2', padding: 8, borderRadius: 8 },
  ok: { background: '#dcfce7', padding: 8, borderRadius: 8 }
}
