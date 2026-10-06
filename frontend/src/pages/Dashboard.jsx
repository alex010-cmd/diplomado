import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { addStock, createProduct, deleteDiscount, fetchDashboard,
         fetchDiscounts, fetchImageUsage, fetchLowStock, fetchMe,
         fetchProducts, fetchSales, fetchTicket, fetchUsers, setDiscount,
         toggleDiscount, updateProduct, uploadProductImage } from '../services/api.js'
import { Card } from '../components/Card.jsx'
import { Ticket } from '../components/Ticket.jsx'

const page = { padding: 24, background: '#f1f5f9', minHeight: '100vh' }
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, maxWidth: 460 }
const err = { background: '#fee2e2', padding: 8, borderRadius: 8 }
const ok = { background: '#dcfce7', padding: 8, borderRadius: 8 }

function Kpis({ kpis }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      {(kpis || []).map((k) => (
        <Card key={k.titulo} title={k.titulo} value={k.valor} detail={k.detalle} />
      ))}
    </div>
  )
}

// ================= DASHBOARD ADMIN =================
export function AdminDash() {
  const { user, token } = useAuth()
  const [dash, setDash] = useState(null)
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [sales, setSales] = useState([])
  const [users, setUsers] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [msg, setMsg] = useState('')
  const [emsg, setEmsg] = useState('')
  const [np, setNp] = useState({ name: '', sku: '', price: '', stock: '', category: 'Alimentos y Abarrotes', image_url: '' })
  const [editing, setEditing] = useState(null)
  const [ep, setEp] = useState({ name: '', price: '', image_url: '' })
  const [usage, setUsage] = useState(null)
  const [newFile, setNewFile] = useState(null)
  const [editFile, setEditFile] = useState(null)
  const [nd, setNd] = useState({ scope: 'seccion', target: '', percent: '' })

  const load = async () => {
    setDash(await fetchDashboard(token))
    setProducts(await fetchProducts(token))
    setAlerts(await fetchLowStock(token))
    setSales(await fetchSales(token))
    setUsers(await fetchUsers(token))
    setDiscounts(await fetchDiscounts(token))
    setUsage(await fetchImageUsage(token))
  }
  useEffect(() => { load().catch((e) => setEmsg(e.message)) }, [])

  const restock = async (p) => {
    const qty = Number(window.prompt(`¿Cuantos desea agregar a "${p.name}"? (stock actual: ${p.stock}, sin limite)`, '10'))
    if (!qty || qty <= 0) return
    try {
      await addStock(token, p, qty)
      setMsg(`Stock actualizado: ${p.name} +${qty}`)
      load()
    } catch (e) { setEmsg(e.message) }
  }

  const checkFile = (f) => {
    if (f && f.size > 2 * 1024 * 1024) { setEmsg('La imagen supera 2MB.'); return null }
    return f
  }

  const newProduct = async (e) => {
    e.preventDefault()
    try {
      const r = await createProduct(token, { ...np, price: Number(np.price), stock: Number(np.stock) })
      if (newFile) await uploadProductImage(token, r.id, newFile)
      setMsg('Producto creado'); setNp({ name: '', sku: '', price: '', stock: '', category: 'Alimentos y Abarrotes', image_url: '' })
      setNewFile(null); load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const saveEdit = async (p) => {
    try {
      await updateProduct(token, p.id, { name: ep.name, price: Number(ep.price), image_url: ep.image_url })
      if (editFile) await uploadProductImage(token, p.id, editFile)
      setMsg(`Producto actualizado: ${ep.name}`); setEditing(null); setEditFile(null); load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const removeImage = async (p) => {
    try {
      await updateProduct(token, p.id, { image_url: '' })
      setMsg(`Imagen eliminada: ${p.name}`); setEditing(null); load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const newDiscount = async (e) => {
    e.preventDefault()
    try {
      await setDiscount(token, nd.scope, nd.target, Number(nd.percent))
      setMsg(`Descuento ${nd.percent}% aplicado a ${nd.scope} "${nd.target}"`)
      setNd({ scope: 'seccion', target: '', percent: '' })
      load()
    } catch (e2) { setEmsg(e2.message) }
  }

  return (
    <div style={page}>
      <h2>Dashboard Admin — {user?.full_name}</h2>
      {emsg && <p style={err}>{emsg}</p>}
      {msg && <p style={ok}>{msg}</p>}
      <Kpis kpis={dash?.kpis} />

      <h3>Notificaciones automaticas: stock menor a 5 ({alerts.length})</h3>
      {alerts.length === 0 && <p>Sin alertas. Todo el inventario esta surtido.</p>}
      {alerts.map((p) => (
        <div key={p.id} style={err}>
          <b>{p.name}</b> ({p.sku}) — quedan <b>{p.stock}</b>. Reabastecer.
          {' '}<button onClick={() => restock(p)}>Agregar stock</button>
        </div>
      ))}

      {usage && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, maxWidth: 420, marginBottom: 8 }}>
          <b>Espacio de imagenes:</b> {(usage.used_bytes / 1048576).toFixed(1)} de {usage.quota_mb} MB
          <div style={{ background: '#e5e7eb', borderRadius: 6, height: 10, marginTop: 4 }}>
            <div style={{ width: `${Math.min(100, usage.used_bytes / usage.quota_bytes * 100)}%`, background: '#059669', height: 10, borderRadius: 6 }} />
          </div>
        </div>
      )}
      <h3>Stock por seccion (+ Stock = agregar sin limite, Editar = precio/nombre/imagen)</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {products.map((p) => (
          <div key={p.id}
            style={{ border: p.stock < 5 ? '2px solid #dc2626' : '1px solid #ccc',
                     borderRadius: 8, padding: 8, background: '#fff' }}>
            <b>{p.name}</b> — ${p.price} — stock <b>{p.stock}</b> <small>({p.category})</small>
            {' '}<button onClick={() => restock(p)}>+ Stock</button>
            {' '}<button onClick={() => { setEditing(p.id); setEp({ name: p.name, price: p.price, image_url: p.image_url || '' }) }}>Editar</button>
            {editing === p.id && (
              <form onSubmit={(e) => { e.preventDefault(); saveEdit(p) }} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <input value={ep.name} onChange={(e) => setEp({ ...ep, name: e.target.value })} placeholder="Nombre" required />
                <input type="number" step="0.01" value={ep.price} onChange={(e) => setEp({ ...ep, price: e.target.value })} placeholder="Precio" required />
                <input value={ep.image_url} onChange={(e) => setEp({ ...ep, image_url: e.target.value })} placeholder="URL imagen externa (opcional)" style={{ minWidth: 220 }} />
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setEditFile(checkFile(e.target.files[0]))} />
                <button>Guardar</button>
                <button type="button" onClick={() => removeImage(p)}>Quitar imagen</button>
                <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
              </form>
            )}
          </div>
        ))}
      </div>

      <h3>Descuentos por seccion o producto</h3>
      <form onSubmit={newDiscount} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={nd.scope} onChange={(e) => setNd({ ...nd, scope: e.target.value })}>
          <option value="seccion">Seccion</option>
          <option value="producto">Producto (SKU)</option>
        </select>
        <input placeholder={nd.scope === 'seccion' ? 'Ej: Bebidas y Botanas' : 'Ej: COC-600'}
               value={nd.target} onChange={(e) => setNd({ ...nd, target: e.target.value })} required />
        <input placeholder="% (1-90)" type="number" step="0.01" value={nd.percent}
               onChange={(e) => setNd({ ...nd, percent: e.target.value })} required />
        <button>Aplicar descuento</button>
      </form>
      {discounts.map((d) => (
        <div key={d.id}>
          {d.scope} "{d.target}" — <b>{d.percent}%</b> [{d.active ? 'activo' : 'inactivo'}]
          {' '}<button onClick={() => toggleDiscount(token, d.id, !d.active).then(load).catch((e) => setEmsg(e.message))}>
            {d.active ? 'Desactivar' : 'Activar'}
          </button>
          {' '}<button onClick={() => deleteDiscount(token, d.id).then(load).catch((e) => setEmsg(e.message))}>Eliminar</button>
        </div>
      ))}

      <h3>Crear producto</h3>
      <form onSubmit={newProduct} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input placeholder="Nombre" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} required />
        <input placeholder="SKU" value={np.sku} onChange={(e) => setNp({ ...np, sku: e.target.value })} required />
        <input placeholder="Precio" type="number" step="0.01" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} required />
        <input placeholder="Stock" type="number" value={np.stock} onChange={(e) => setNp({ ...np, stock: e.target.value })} required />
        <input placeholder="Categoria" value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} />
        <input placeholder="URL imagen externa (opcional)" value={np.image_url} onChange={(e) => setNp({ ...np, image_url: e.target.value })} style={{ minWidth: 220 }} />
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setNewFile(checkFile(e.target.files[0]))} />
        <button>Crear</button>
      </form>
      <small>Las imagenes se guardan en disco del servidor (no en la DB), max 2MB c/u. Sugerencia: agrega pocas imagenes, el espacio es limitado ({usage ? `${(usage.used_bytes / 1048576).toFixed(1)} de ${usage.quota_mb} MB usados` : '...'}).</small>

      <h3>Ventas ({sales.length})</h3>
      {sales.map((s) => (
        <div key={s.id}>#{s.id} {s.buyer_name} — ${s.total} (desc ${s.discount}, IVA ${s.iva}, {s.pay_method}) {s.detalle && <small>[{s.detalle}]</small>}</div>
      ))}
      <h3>Usuarios ({users.length})</h3>
      {users.map((u) => (
        <div key={u.id}>{u.username} — {u.role} (id {u.id}) {u.email} {u.first_purchase_done && '(1ra compra usada)'}</div>
      ))}
    </div>
  )
}

// ================= DASHBOARD CLIENTE =================
export function ClienteDash({ go }) {
  const { user, token } = useAuth()
  const [sales, setSales] = useState([])
  const [profile, setProfile] = useState(null)
  const [emsg, setEmsg] = useState('')
  const [ticket, setTicket] = useState(null)

  useEffect(() => {
    fetchSales(token).then(setSales).catch((e) => setEmsg(e.message))
    fetchMe(token).then((me) => setProfile(me)).catch(() => {})
  }, [])

  const verTicket = async (id) => {
    try { setTicket(await fetchTicket(token, id)) }
    catch (e) { setEmsg(e.message) }
  }

  return (
    <div style={page}>
      <h2>Dashboard Cliente — {user?.full_name}</h2>
      {profile && (
        <div style={card}>
          <b>Mi cuenta</b>
          <div>Nombre: {profile.full_name}</div>
          <div>Correo: {profile.email || '(sin registrar)'}</div>
          <div>Direccion de entrega: {profile.address || '(sin registrar)'}</div>
        </div>
      )}
      {!user?.first_purchase_done && <p style={ok}>Aun no usas tu 15% de primera compra.</p>}
      <p><button onClick={() => go('tienda')}>Ver y comprar productos</button></p>
      {emsg && <p style={err}>{emsg}</p>}
      <h3>Historial de compras a mi nombre y correo ({sales.length})</h3>
      {sales.map((s) => (
        <div key={s.id}>#{s.id} {s.buyer_name} — ${s.total} (desc ${s.discount}, IVA ${s.iva}) <button onClick={() => verTicket(s.id)}>Ver ticket</button></div>
      ))}
      {ticket && (
        <div style={{ marginTop: 12 }}>
          <Ticket sale={ticket} lines={ticket.items} />
        </div>
      )}
    </div>
  )
}

// Router por rol
export function Dashboard({ go }) {
  const { user } = useAuth()
  if (user?.role === 'admin') return <AdminDash />
  return <ClienteDash go={go} />
}
