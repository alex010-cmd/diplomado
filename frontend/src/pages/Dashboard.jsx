import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { addStock, createProduct, deleteDiscount, fetchDashboard,
         fetchDiscounts, fetchImageUsage, fetchLowStock, fetchMe,
         fetchProducts, fetchSales, fetchTicket, fetchUsers, setDiscount,
         toggleDiscount, updateProduct, uploadProductImage,
         fetchDepartments, fetchDepartmentCounts } from '../services/api.js'
import { Card } from '../components/Card.jsx'
import { Ticket } from '../components/Ticket.jsx'
import { StoreView } from '../components/Shop.jsx'


function Kpis({ kpis }) {
  return (
    <div className="kpi-row">
      {(kpis || []).map((k) => (
        <Card key={k.titulo} title={k.titulo} value={k.valor} detail={k.detalle} />
      ))}
    </div>
  )
}

// ================= DASHBOARD ADMIN =================
export function AdminDash() {
  const { user } = useAuth()
  const [dash, setDash] = useState(null)
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [sales, setSales] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [msg, setMsg] = useState('')
  const [emsg, setEmsg] = useState('')
  const [np, setNp] = useState({ name: '', price: '', stock: '', category: '', description: '' })
  const [showNew, setShowNew] = useState(false)
  const [departments, setDepartments] = useState([])
  const [editing, setEditing] = useState(null)
  const [ep, setEp] = useState({ name: '', price: '', description: '' })
  const [showRestock, setShowRestock] = useState(false)
  const [restDept, setRestDept] = useState('')
  const [restProdId, setRestProdId] = useState('')
  const [restockQty, setRestockQty] = useState('')
  const [showDiscounts, setShowDiscounts] = useState(false)
  const [deptCounts, setDeptCounts] = useState([])
  const [usage, setUsage] = useState(null)
  const [newFile, setNewFile] = useState(null)
  const [editFile, setEditFile] = useState(null)
  const [nd, setNd] = useState({ scope: 'seccion', target: '', percent: '' })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const load = async () => {
    setDash(await fetchDashboard())
    const guard = await fetchProducts()
    setProducts(Array.isArray(guard) ? guard : [])
    setAlerts(await fetchLowStock())
    setSales(await fetchSales())
    setDiscounts(await fetchDiscounts())
    setUsage(await fetchImageUsage())
    setDepartments(await fetchDepartments())
    setDeptCounts(await fetchDepartmentCounts())
  }
  useEffect(() => { load().catch((e) => setEmsg(e.message)) }, [])

  // Popup unico de reabastecimiento: departamento -> producto -> sumar.
  const openRestock = (p) => {
    setEmsg('')
    if (p) { setRestDept(p.category || ''); setRestProdId(String(p.id)) }
    else { setRestDept(''); setRestProdId('') }
    setRestockQty('')
    setShowRestock(true)
  }
  const restockProducts = products.filter((x) => !restDept || x.category === restDept)
  const restockTarget = products.find((x) => String(x.id) === String(restProdId))

  const saveRestock = async (e) => {
    e.preventDefault()
    const qty = Number(restockQty)
    if (!restockTarget) { setEmsg('Elige el producto'); return }
    if (!qty || qty <= 0) { setEmsg('Cantidad invalida'); return }
    try {
      const updated = await addStock(restockTarget, qty)
      setMsg(`Stock actualizado: ${updated.name} +${qty} = ${updated.stock} piezas`)
      setShowRestock(false)
      setRestockQty('')
      load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const checkFile = (f) => {
    if (f && f.size > 2 * 1024 * 1024) { setEmsg('La imagen supera 2MB.'); return null }
    return f
  }

  const newProduct = async (e) => {
    e.preventDefault()
    try {
      const r = await createProduct( { name: np.name, price: Number(np.price), stock: Number(np.stock) || 0, category: np.category, description: np.description })
      if (newFile) await uploadProductImage(r.id, newFile)
      setMsg('Producto creado (SKU autoasignado)'); setNp({ name: '', price: '', stock: '', category: '', description: '' })
      setNewFile(null); setShowNew(false); load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const saveEdit = async (p) => {
    try {
      await updateProduct(p.id, { name: ep.name, price: Number(ep.price), description: ep.description })
      if (editFile) await uploadProductImage(p.id, editFile)
      setMsg(`Producto actualizado: ${ep.name}`); setEditing(null); setEditFile(null); load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const removeImage = async (p) => {
    try {
      await updateProduct(p.id, { image_url: '' })
      setMsg(`Imagen eliminada: ${p.name}`); setEditing(null); load()
    } catch (e2) { setEmsg(e2.message) }
  }

  const newDiscount = async (e) => {
    e.preventDefault()
    try {
      await setDiscount(nd.scope, nd.target, Number(nd.percent))
      setMsg(`Descuento ${nd.percent}% aplicado a ${nd.scope} "${nd.target}"`)
      setNd({ scope: 'seccion', target: '', percent: '' })
      load()
    } catch (e2) { setEmsg(e2.message) }
  }

  return (
    <div className={`admin-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Mostrar menu' : 'Ocultar menu'} title={sidebarCollapsed ? 'Mostrar menu' : 'Ocultar menu'}>
          <span aria-hidden="true">{sidebarCollapsed ? '>' : '<'}</span><b>{sidebarCollapsed ? 'Mostrar menu' : 'Ocultar menu'}</b>
        </button>
        <p className="admin-side-label">Administracion</p>
        <nav className="admin-nav" aria-label="Secciones del panel">
          <a className="admin-nav-link active" href="#admin-overview"><i aria-hidden="true">⌂</i><span>01</span><b>Resumen</b></a>
          <a className="admin-nav-link" href="#admin-inventory"><i aria-hidden="true">▦</i><span>02</span><b>Inventario</b></a>
          <a className="admin-nav-link" href="#admin-sales"><i aria-hidden="true">$</i><span>03</span><b>Ventas recientes</b></a>
        </nav>
        <div className="admin-side-note"><span className="status-dot" /><b>Sistema operativo</b><small>Datos sincronizados</small></div>
      </aside>

      <main className="admin-main page-full">
        <header className="admin-header" id="admin-overview">
          <div><p className="admin-kicker">Centro de control</p><h2>Buen dia, {user?.full_name}</h2><p className="muted">Gestiona el movimiento de tu tienda desde un solo lugar.</p></div>
          <div className="admin-header-mark">{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</div>
        </header>
        {emsg && <p className="err admin-feedback">{emsg}</p>}
        {msg && <p className="ok admin-feedback">{msg}</p>}
        <Kpis kpis={dash?.kpis} />

        <section className="admin-action-grid" aria-label="Acciones de inventario">
          <button className="admin-action action-stock" onClick={() => openRestock(null)}><span className="action-icon">+</span><span><b>Reabastecer stock</b><small>Actualiza existencias</small></span><strong>&gt;</strong></button>
          <button className="admin-action action-discount" onClick={() => { setShowDiscounts(true); setNd({ scope: 'seccion', target: '', percent: '' }) }}><span className="action-icon">%</span><span><b>Descuentos</b><small>Promociones por departamento</small></span><strong>&gt;</strong></button>
          <button className="admin-action action-product" onClick={() => setShowNew(true)}><span className="action-icon">+</span><span><b>Agregar producto</b><small>Amplia tu catalogo</small></span><strong>&gt;</strong></button>
        </section>

        <div className="admin-overview-grid">
          <section className="admin-panel admin-alert-panel">
            <div className="section-heading"><div><p className="admin-kicker">Atencion requerida</p><h3>Stock bajo <span>{alerts.length}</span></h3></div><span className="panel-mark">!</span></div>
            {alerts.length === 0 && <p className="muted">Sin alertas. Todo el inventario esta surtido.</p>}
            {alerts.map((p) => <div key={p.id} className="admin-alert-row"><span><b>{p.name}</b><small>{p.sku} · quedan {p.stock}</small></span><button onClick={() => openRestock(p)}>Reabastecer</button></div>)}
          </section>
          {usage && <section className="admin-panel storage-panel"><div className="section-heading"><div><p className="admin-kicker">Almacenamiento</p><h3>Imagenes</h3></div><b>{(usage.used_bytes / 1048576).toFixed(1)} <small>/ {usage.quota_mb} MB</small></b></div><div className="usage-bar"><div className="usage-fill" style={{ width: `${Math.min(100, usage.used_bytes / usage.quota_bytes * 100)}%` }} /></div><small className="muted">Espacio utilizado en el servidor</small></section>}
        </div>

        <section className="admin-panel inventory-panel" id="admin-inventory">
          <div className="section-heading inventory-heading"><div><p className="admin-kicker">Catalogo activo</p><h3>Inventario <span>{products.length} productos</span></h3></div><button className="btn-primary" onClick={() => setShowNew(true)}>+ Agregar producto</button></div>
          <p className="muted panel-intro">Selecciona cualquier producto para editar su informacion, precio o imagen.</p>
          <StoreView products={products} actionLabel="Editar" hideEmpty={false} showStock
            onAction={(p) => { setEditing(p); setEp({ name: p.name, price: p.price, description: p.description || '' }); setEditFile(null) }} />
        </section>
      <div className="admin-legacy-actions"><p><button className="btn-primary" onClick={() => openRestock(null)}>Reabastecer stock</button></p></div>
      {editing && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <button type="button" className="auth-x" title="Cerrar" onClick={() => setEditing(null)}>X</button>
            <h3>Editar producto</h3>
            <p className="muted">SKU actual: <b>{editing.sku}</b> (se reasigna solo al guardar)</p>
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(editing) }} style={{ display: 'grid', gap: 8 }}>
              <label>Nombre (opcional)<input value={ep.name} onChange={(e) => setEp({ ...ep, name: e.target.value })} /></label>
              <label>Precio (opcional)<input type="number" step="0.01" value={ep.price} onChange={(e) => setEp({ ...ep, price: e.target.value })} /></label>
              <label>Caracteristicas (opcional)<input value={ep.description} onChange={(e) => setEp({ ...ep, description: e.target.value })} /></label>
              <label>Imagen de referencia (opcional, max 2MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setEditFile(checkFile(e.target.files[0]))} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary">Guardar</button>
                <button type="button" onClick={() => removeImage(editing)}>Quitar imagen</button>
                <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showRestock && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <button type="button" className="auth-x" title="Cerrar" onClick={() => setShowRestock(false)}>X</button>
            <h3>Reabastecer stock</h3>
            <form onSubmit={saveRestock} style={{ display: 'grid', gap: 8 }}>
              <label>Departamento*
                <select value={restDept} onChange={(e) => { setRestDept(e.target.value); setRestProdId('') }} required>
                  <option value="">— Elige el departamento —</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </label>
              <label>Producto*
                <select value={restProdId} onChange={(e) => setRestProdId(e.target.value)} required disabled={!restDept}>
                  <option value="">— Elige el producto —</option>
                  {restockProducts.map((p) => <option key={p.id} value={p.id}>{p.name} (quedan {p.stock})</option>)}
                </select>
              </label>
              {restockTarget && <p>Existencias actuales: <b>{restockTarget.stock} piezas</b></p>}
              <label>Unidades nuevas a agregar<input type="number" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="Ej: 20" required /></label>
              <button className="btn-primary">Guardar stock</button>
            </form>
          </div>
        </div>
      )}

      <section className="admin-panel admin-secondary-panel"><div className="section-heading"><div><p className="admin-kicker">Reglas comerciales</p><h3>Descuentos</h3></div><button className="btn-primary" onClick={() => { setShowDiscounts(true); setNd({ scope: 'seccion', target: '', percent: '' }) }}>Descuentos por departamento</button></div></section>
      {showDiscounts && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <button type="button" className="auth-x" title="Cerrar" onClick={() => setShowDiscounts(false)}>X</button>
            <h3>Descuentos por departamento</h3>
            <p className="muted">Al aplicar, todos los productos del departamento reciben el descuento en automatico.</p>
            <form onSubmit={newDiscount} style={{ display: 'grid', gap: 8 }}>
              <label>Departamento*
                <select value={nd.scope === 'seccion' ? nd.target : ''} onChange={(e) => setNd({ scope: 'seccion', target: e.target.value, percent: nd.percent })} required>
                  <option value="">— Elige el departamento —</option>
                  {deptCounts.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.products} productos)</option>)}
                </select>
              </label>
              <label>Porcentaje (1-90)*<input type="number" step="0.01" value={nd.percent} onChange={(e) => setNd({ ...nd, percent: e.target.value })} required /></label>
              <button className="btn-primary">Aplicar descuento</button>
            </form>
            <h4>Descuentos vigentes</h4>
            {discounts.map((d) => (
              <div key={d.id}>
                {d.scope} "{d.target}" — <b>{d.percent}%</b> [{d.active ? 'activo' : 'inactivo'}]
                {' '}<button onClick={() => toggleDiscount(d.id, !d.active).then(load).catch((e) => setEmsg(e.message))}>
                  {d.active ? 'Desactivar' : 'Activar'}
                </button>
                {' '}<button onClick={() => deleteDiscount(d.id).then(load).catch((e) => setEmsg(e.message))}>Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-legacy-product-heading"><h3>Productos <button className="btn-primary" onClick={() => setShowNew(true)}>+ Agregar producto</button></h3></div>
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <button type="button" className="auth-x" title="Cerrar" onClick={() => setShowNew(false)}>X</button>
            <h3>Nuevo producto</h3>
            <form onSubmit={newProduct} style={{ display: 'grid', gap: 8 }}>
              <label>Departamento*
                <select value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} required>
                  <option value="">— Elige el departamento —</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </label>
              <label>Nombre*<input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} required /></label>
              <label>Caracteristicas*<input value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} placeholder="Ej: bolsa 1kg, marca X" required /></label>
              <p className="muted">El SKU se asigna solo (departamento + producto + stock).</p>
              <label>Precio*<input type="number" step="0.01" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} required /></label>
              <label>Stock inicial<input type="number" value={np.stock} onChange={(e) => setNp({ ...np, stock: e.target.value })} /></label>
              <label>Imagen de referencia (opcional, max 2MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setNewFile(checkFile(e.target.files[0]))} /></label>
              <button className="btn-primary">Crear producto</button>
            </form>
          </div>
        </div>
      )}
      <small>Las imagenes se guardan en disco del servidor (no en la DB), max 2MB c/u. Sugerencia: agrega pocas imagenes, el espacio es limitado ({usage ? `${(usage.used_bytes / 1048576).toFixed(1)} de ${usage.quota_mb} MB usados` : '...'}).</small>

      <section className="admin-panel sales-panel" id="admin-sales">
        <div className="section-heading"><div><p className="admin-kicker">Actividad reciente</p><h3>Ventas recientes <span>{sales.length} registros</span></h3></div><span className="panel-mark">$</span></div>
        <div className="sales-list">{sales.map((s) => (
          <div key={s.id} className="sale-row"><span><b>#{s.id} · {s.buyer_name}</b><small>{s.pay_method}{s.detalle ? ` · ${s.detalle}` : ''}</small></span><strong>${s.total}</strong><small>IVA ${s.iva}</small></div>
        ))}</div>
      </section>
      </main>
    </div>
  )
}

// ================= DASHBOARD CLIENTE =================
export function ClienteDash({ go }) {
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [profile, setProfile] = useState(null)
  const [emsg, setEmsg] = useState('')
  const [ticket, setTicket] = useState(null)

  useEffect(() => {
    fetchSales().then(setSales).catch((e) => setEmsg(e.message))
    fetchMe().then((me) => setProfile(me)).catch(() => {})
  }, [])

  const verTicket = async (id) => {
    try { setTicket(await fetchTicket(id)) }
    catch (e) { setEmsg(e.message) }
  }

  return (
    <div className="page-full client-dashboard">
      <header className="client-header"><div><p className="admin-kicker">Area personal</p><h2>Hola, {user?.full_name}</h2><p className="muted">Consulta tus datos y el historial de tus compras.</p></div><div className="client-avatar" aria-hidden="true">{(user?.full_name || '?')[0].toUpperCase()}</div></header>
      {profile && (
        <div className="client-profile card">
          <div className="client-profile-title"><div><p className="admin-kicker">Cuenta activa</p><h3>Mi perfil</h3></div><span className="profile-role">{profile.role}</span></div>
          <div className="client-profile-grid"><div><small>Nombre completo</small><b>{profile.full_name}</b></div><div><small>Correo electronico</small><b>{profile.email || 'Sin registrar'}</b></div><div><small>Direccion de entrega</small><b>{profile.address || 'Sin registrar'}</b></div></div>
        </div>
      )}
      {!user?.first_purchase_done && <p className="ok">Aun no usas tu 15% de primera compra.</p>}
      <p><button onClick={() => go('tienda')}>Ver y comprar productos</button></p>
      {emsg && <p className="err">{emsg}</p>}
      <section className="client-sales card"><div className="client-profile-title"><div><p className="admin-kicker">Actividad</p><h3>Historial de compras</h3></div><span className="sales-count">{sales.length} registros</span></div>
      {sales.map((s) => (
        <div key={s.id} className="client-sale-row"><span><b>Compra #{s.id}</b><small>{s.buyer_name} · Descuento ${s.discount} · IVA ${s.iva}</small></span><strong>${s.total}</strong><button onClick={() => verTicket(s.id)}>Ver ticket</button></div>
      ))}
      {sales.length === 0 && <p className="muted">Todavia no tienes compras registradas.</p>}
      </section>
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
