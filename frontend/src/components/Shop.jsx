import React, { useEffect, useMemo, useRef, useState } from 'react'
import { resolveImg } from '../services/api.js'
import { useCart } from '../context/CartContext.jsx'

// Imagen con respaldo: si no hay URL, mosaico con la inicial.
// Las rutas /images/... se resuelven contra el backend (disco, no DB).
export function PImg({ product, size = 120 }) {
  const [err, setErr] = useState(false)
  const src = resolveImg(product.image_url)
  if (src && !err) {
    return <img src={src} alt={product.name} width={size} height={size}
      style={{ objectFit: 'cover', borderRadius: 8 }} onError={() => setErr(true)} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: '#0f172a',
      color: '#fff', display: 'grid', placeItems: 'center',
      fontSize: size / 2.5, fontWeight: 700 }}>
      {(product.name || '?')[0].toUpperCase()}
    </div>
  )
}

// Badge de color segun departamento (fresco por categoria).
export function catClass(category) {
  const c = category || ''
  if (c.startsWith('Alimentos')) return 'cat-badge cat-alimentos'
  if (c.startsWith('Bebidas')) return 'cat-badge cat-bebidas'
  if (c.startsWith('Higiene')) return 'cat-badge cat-higiene'
  if (c.startsWith('Lacteos')) return 'cat-badge cat-lacteos'
  return 'cat-badge cat-otro'
}

export function stockPill(stock) {
  if (stock <= 0) return <span className="stock-pill out">SIN STOCK</span>
  if (stock === 1) return <span className="stock-pill low">Ultima pieza!</span>
  if (stock <= 5) return <span className="stock-pill low">Ultimas {stock} piezas</span>
  return <span className="stock-pill ok">Stock: {stock}</span>
}

// Carrusel horizontal por seccion: imagen + nombre + precio.
function Carousel({ title, list, actionLabel, onAction, showStock }) {
  const ref = useRef(null)
  const scroll = (d) => ref.current && ref.current.scrollBy({ left: d * 360, behavior: 'smooth' })
  if (!list.length) return null
  return (
    <div className="carousel-block">
      <h3>{title} ({list.length})</h3>
      <div className="carousel-row">
        <button className="carousel-arrow" onClick={() => scroll(-1)} aria-label="Anterior">‹</button>
        <div ref={ref} className="carousel-track">
          {list.map((p) => (
            <div key={p.id} className="product-card">
              <PImg product={p} size={120} />
              <b className="name">{p.name}</b>
              <span className={catClass(p.category)}>{p.category}</span>
              {p.description ? <small className="muted">{p.description}</small> : null}
              <small className="muted">{p.sku}</small>
              {p.discount > 0
                ? <small className="price"><s>${p.price}</s> <b>${(p.price * (1 - p.discount / 100)).toFixed(2)}</b> <span className="off-badge">{p.discount}% OFF</span></small>
                : <small className="price">${p.price}</small>}
              {(showStock || p.stock <= 5) && stockPill(p.stock)}
              {onAction && (p.stock > 0 || showStock) && (
                <button className="btn-primary add-btn" onClick={() => onAction(p)}>{actionLabel}</button>
              )}
            </div>
          ))}
        </div>
        <button className="carousel-arrow" onClick={() => scroll(1)} aria-label="Siguiente">›</button>
      </div>
    </div>
  )
}

// Vista de catalogo por secciones (tienda del cliente y vista del admin).
// hideEmpty=true: oculta agotados (cliente). false: muestra todo (admin).
export function StoreView({ products, actionLabel, onAction, hideEmpty, showStock }) {
  const [section, setSection] = useState('Todas')
  const groups = useMemo(() => {
    const g = {}
    for (const p of (Array.isArray(products) ? products : [])) {
      if (hideEmpty && p.stock <= 0) continue
      ;(g[p.category || 'General'] ||= []).push(p)
    }
    return g
  }, [products, hideEmpty])
  const sections = ['Todas', ...Object.keys(groups)]
  const visible = section === 'Todas' ? Object.entries(groups) : [[section, groups[section] || []]]
  return (
    <div>
      <div className="chips">
        {sections.map((c) => (
          <button key={c} onClick={() => setSection(c)} aria-pressed={c === section}
            className={c === section ? 'chip-on' : 'chip'}>{c}</button>
        ))}
      </div>
      {visible.map(([cat, list]) => (
        <Carousel key={cat} title={cat} list={list}
                  actionLabel={actionLabel} onAction={onAction} showStock={showStock} />
      ))}
    </div>
  )
}

// Catalogo publico. El carrito vive en CartContext (popup del navbar).
// Invitado que pulsa Agregar: abre EL popup unico de acceso y al entrar
// se agrega solo el producto pendiente.
export function Shop({ products, openAuth }) {
  const cart = useCart()
  const [pendingAdd, setPendingAdd] = useState(null)

  const add = (p) => {
    if (!cart.canShop) {
      setPendingAdd(p)
      openAuth && openAuth({ tab: 'login' })
      return
    }
    cart.add(p).catch((e) => cart.setMsg(e.message))
  }
  useEffect(() => {
    if (pendingAdd && cart.canShop) {
      const p = pendingAdd
      setPendingAdd(null)
      add(p)
    }
  }, [pendingAdd, cart.canShop]) // eslint-disable-line

  return (
    <StoreView products={products} actionLabel="Agregar"
               onAction={add} hideEmpty showStock={false} />
  )
}
