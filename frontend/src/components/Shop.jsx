import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cartPreview, getHolder, release, reserve, resolveImg } from '../services/api.js'
import { PayPopup } from './PayPopup.jsx'

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

// Carrusel horizontal por seccion: imagen + nombre + precio.
function Carousel({ title, list, onAdd }) {
  const ref = useRef(null)
  const scroll = (d) => ref.current && ref.current.scrollBy({ left: d * 360, behavior: 'smooth' })
  if (!list.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <h3>{title} ({list.length})</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => scroll(-1)} aria-label="Anterior">‹</button>
        <div ref={ref} style={s.track}>
          {list.map((p) => (
            <div key={p.id} style={s.slide}>
              <PImg product={p} size={120} />
              <b style={{ fontSize: 13 }}>{p.name}</b>
              <small>{p.sku}</small>
              {p.discount > 0
                ? <small><s>${p.price}</s> <b style={{ color: '#059669' }}>${(p.price * (1 - p.discount / 100)).toFixed(2)}</b> <span style={s.off}>{p.discount}% OFF</span></small>
                : <small>${p.price}</small>}
              <small style={{ color: p.stock <= 5 ? '#b45309' : '#059669', fontWeight: p.stock <= 5 ? 700 : 400 }}>
                {p.stock === 1 ? 'Ultima pieza!' : p.stock <= 5 ? `Ultimas ${p.stock} piezas` : `Stock: ${p.stock}`}
              </small>
              <button onClick={() => onAdd(p)}>Agregar</button>
            </div>
          ))}
        </div>
        <button onClick={() => scroll(1)} aria-label="Siguiente">›</button>
      </div>
    </div>
  )
}

// Catalogo + carrito con reserva real de stock en la DB.
// El ticket se genera en vivo (total, descuento, IVA). Pagar abre el popup.
export function Shop({ user, token, products, onCheckout, busy, onStockChange }) {
  const [cart, setCart] = useState({})
  const [buyer, setBuyer] = useState('')
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState(null)
  const [showPay, setShowPay] = useState(false)
  const [payErr, setPayErr] = useState('')
  const [section, setSection] = useState('Todas')
  const [openLines, setOpenLines] = useState({})
  const holder = getHolder(user)

  const groups = useMemo(() => {
    const g = {}
    for (const p of products) {
      if (p.stock <= 0) continue // agotados no se muestran
      ;(g[p.category || 'General'] ||= []).push(p)
    }
    return g
  }, [products])
  const sections = ['Todas', ...Object.keys(groups)]

  const items = Object.entries(cart).map(([pid, qty]) => ({
    product_id: Number(pid), qty
  }))

  // Ticket en vivo: recalcula al cambiar el carrito (sin vender)
  useEffect(() => {
    if (!items.length) { setPreview(null); return }
    cartPreview(items, token || undefined).then(setPreview).catch(() => setPreview(null))
  }, [JSON.stringify(cart)]) // eslint-disable-line

  const sync = async (fn) => {
    try { await fn(); onStockChange && onStockChange() }
    catch (e) { setMsg(e.message) }
  }

  const add = (p) => sync(async () => {
    setMsg('')
    await reserve(holder, p.id, 1, token || undefined)
    setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))
  })

  const dec = (p) => sync(async () => {
    const q = cart[p.id] || 0
    if (!q) return
    await release(holder, p.id, 1, token || undefined)
    setCart((c) => {
      const n = { ...c }
      if ((n[p.id] || 0) <= 1) delete n[p.id]
      else n[p.id] -= 1
      return n
    })
  })

  // Quitar por completo sin importar cuantos tenga
  const removeLine = (p) => sync(async () => {
    await release(holder, p.id, null, token || undefined)
    setCart((c) => { const n = { ...c }; delete n[p.id]; return n })
  })

  const clear = async () => {
    for (const pid of Object.keys(cart)) {
      try { await release(holder, Number(pid), null, token || undefined) } catch { /* sigue */ }
    }
    setCart({})
    onStockChange && onStockChange()
  }

  const lines = items.map(({ product_id, qty }) => {
    const p = products.find((x) => x.id === product_id)
    return p ? { ...p, qty } : null
  }).filter(Boolean)

  const doPay = async ({ pay_method }) => {
    setPayErr('')
    try {
      await onCheckout(items, buyer || undefined, holder, pay_method)
      setCart({}); setBuyer(''); setShowPay(false)
    } catch (e) { setPayErr(e.message) }
  }

  const visible = section === 'Todas' ? Object.entries(groups) : [[section, groups[section] || []]]

  return (
    <div>
      {msg && <p style={s.err}>{msg}</p>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {sections.map((c) => (
          <button key={c} onClick={() => setSection(c)}
            style={c === section ? s.chipOn : s.chip}>{c}</button>
        ))}
      </div>
      {visible.map(([cat, list]) => (
        <Carousel key={cat} title={cat} list={list} onAdd={add} />
      ))}

      <h3>Carrito</h3>
      {lines.length === 0 && <p>Carrito vacio.</p>}
      {lines.map((i) => {
        const hasDesc = (i.discount || 0) > 0
        const orig = i.price * i.qty
        const final = orig * (1 - (i.discount || 0) / 100)
        const open = !!openLines[i.id]
        return (
          <div key={i.id} style={s.line}>
            <PImg product={i} size={48} />
            <div style={{ flex: 1 }}>
              <div>{i.name} x{i.qty}</div>
              {hasDesc ? (
                <button style={s.priceBtn} title="Clic para ver el desglose"
                        onClick={() => setOpenLines((o) => ({ ...o, [i.id]: !o[i.id] }))}>
                  ${final.toFixed(2)} {open ? '▲' : '▼'}
                </button>
              ) : (
                <div>${orig.toFixed(2)}</div>
              )}
              {hasDesc && open && (
                <div style={s.breakdown}>
                  <div>Precio: ${orig.toFixed(2)}</div>
                  <div>Descuento {i.discount}%: −${(orig - final).toFixed(2)}</div>
                  <div><b>Queda en: ${final.toFixed(2)}</b></div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => add(i)} title="Agregar uno mas">+</button>
              <button onClick={() => dec(i)} title="Quitar uno">-</button>
              <button onClick={() => removeLine(i)} title="Quitar por completo">Quitar todo</button>
            </div>
          </div>
        )
      })}

      {preview && (
        <div style={s.resume}>
          <b>Ticket (en vivo)</b>
          <div>Subtotal: ${preview.subtotal}</div>
          <div>Descuento: ${preview.discount}{preview.detalle ? ` (${preview.detalle})` : ''}</div>
          <div>IVA 16%: ${preview.iva}</div>
          <div><b>Total: ${preview.total}</b></div>
        </div>
      )}

      {lines.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!user && (
            <input placeholder="Tu nombre (invitado)" value={buyer}
                   onChange={(e) => setBuyer(e.target.value)} />
          )}
          <button onClick={clear}>Vaciar carrito</button>
        </div>
      )}

      {lines.length > 0 && preview && (
        <div style={{ marginTop: 12 }}>
          <button style={s.pay} onClick={() => { setPayErr(''); setShowPay(true) }}>
            Pagar ${preview.total}
          </button>
        </div>
      )}

      {showPay && preview && (
        <PayPopup user={user} preview={preview}
                  lines={lines.map((i) => ({ product: i.name, qty: i.qty, unit_price: i.price }))}
                  busy={busy} error={payErr}
                  onClose={() => setShowPay(false)} onPay={doPay} />
      )}
    </div>
  )
}

const s = {
  track: { display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 2px',
           scrollSnapType: 'x mandatory', flex: 1 },
  slide: { minWidth: 170, maxWidth: 170, background: '#fff', scrollSnapAlign: 'start',
           border: '1px solid #e5e7eb', borderRadius: 10, padding: 10,
           display: 'grid', gap: 4, justifyItems: 'center', textAlign: 'center' },
  off: { background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '0 4px' },
  chip: { border: '1px solid #ccc', borderRadius: 16, padding: '4px 12px', background: '#fff' },
  chipOn: { border: '1px solid #0f172a', borderRadius: 16, padding: '4px 12px',
            background: '#0f172a', color: '#fff' },
  line: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: 6, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' },
  priceBtn: { background: '#ecfdf5', border: '1px solid #059669', borderRadius: 6,
              fontWeight: 700, cursor: 'pointer' },
  breakdown: { background: '#f8fafc', borderRadius: 6, padding: 6, marginTop: 4,
               display: 'grid', gap: 2, fontSize: 13 },
  resume: { background: '#fff', border: '2px solid #0f172a', borderRadius: 10,
            padding: 12, maxWidth: 320, marginTop: 8, display: 'grid', gap: 2 },
  pay: { background: '#059669', color: '#fff', fontSize: 18, padding: '10px 28px',
         border: 'none', borderRadius: 10, cursor: 'pointer' },
  err: { background: '#fee2e2', padding: 8, borderRadius: 8 }
}
