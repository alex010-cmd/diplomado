import React, { useEffect, useState } from 'react'
import { changePassword, fetchMe, updateProfile } from '../services/api.js'

// Popup centrado "Mi perfil" (engrane): mismo estilo que los demas popups.
// Admin: formulario de ajustes exacto. Cliente: su informacion + sus ajustes.
export function ProfilePopup({ onClose, onUpdated }) {
  const [form, setForm] = useState({ full_name: '', email: '', address: '' })
  const [info, setInfo] = useState(null)
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [msg, setMsg] = useState('')
  const [emsg, setEmsg] = useState('')

  useEffect(() => {
    fetchMe().then((me) => {
      setInfo(me)
      setForm({ full_name: me.full_name || '', email: me.email || '', address: me.address || '' })
    }).catch((e) => setEmsg(e.message))
  }, [])

  const save = async (e) => {
    e.preventDefault(); setEmsg(''); setMsg('')
    try {
      const me = await updateProfile(form)
      setInfo(me); setMsg('Perfil actualizado.')
      onUpdated && onUpdated(me)
    } catch (e2) { setEmsg(e2.message) }
  }

  const savePw = async (e) => {
    e.preventDefault(); setEmsg(''); setMsg('')
    try {
      await changePassword(pw.current_password, pw.new_password)
      setMsg('Contrasena actualizada.')
      setPw({ current_password: '', new_password: '' })
    } catch (e2) { setEmsg(e2.message) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <button type="button" className="auth-x" title="Cerrar" onClick={onClose}>X</button>
        <h3>Mi perfil</h3>
        {emsg && <p className="err">{emsg}</p>}
        {msg && <p className="ok">{msg}</p>}
        {info && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div><b>{info.full_name}</b> ({info.role})</div>
            <div className="muted">{info.email || '(sin correo)'} · {info.address || '(sin direccion)'}</div>
          </div>
        )}
        <h4>Ajustes de cuenta</h4>
        <form onSubmit={save} style={{ display: 'grid', gap: 8 }}>
          <b>Perfil</b>
          <label>Nombre completo<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
          <label>Correo<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Direccion de entrega<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, numero, colonia, ciudad" /></label>
          <button className="btn-primary">Guardar cambios</button>
        </form>
        <h4>Cambiar contrasena</h4>
        <form onSubmit={savePw} style={{ display: 'grid', gap: 8 }}>
          <label>Actual<input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></label>
          <label>Nueva (min 6)<input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></label>
          <button>Actualizar contrasena</button>
        </form>
      </div>
    </div>
  )
}
