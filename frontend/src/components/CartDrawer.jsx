import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { PImg } from './Shop.jsx'
import { PayPopup } from './PayPopup.jsx'

// Carrito desplegable desde el navbar (estilo tienda moderna).
// Conserva TODA la funcionalidad: +/- , quitar todo, vaciar, desglose de
// descuento por linea, ticket en vivo (subtotal/descuento/IVA/total) y pago.
export function CartDrawer({ onCheckout, busy }) {
  const { user } = useAuth()
  const cart = useCart()
  const [openLines, setOpenLines] = useState({})
  const [showPay, setShowPay] = useState(false)
  const [payErr, setPayErr] = useState('')

  if (!cart.open || !cart.canShop) return null

  const lines = cart.items.map(({ product_id, qty }) => {
    const p = cart.catalog.find((x) => x.id === product_id)
    return p ? { ...p, qty } : null
  }).filter(Boolean)

  const doPay = async ({ pay_method }) => {
    setPayErr('')
    try {
      await onCheckout(cart.items, pay_method)
      cart.resetAfterPay()
      setShowPay(false)
      cart.close()
    } catch (e) { setPayErr(e.message) }
  }

  return (
    <div className="drawer-overlay" onClick={cart.close}>
      <aside className="cart-drawer" role="dialog" aria-modal="true"
             aria-label="Carrito de compras" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <span className="drawer-title">Mi carrito ({cart.count})</span>
          <button className="auth-x" title="Cerrar" onClick={cart.close}>X</button>
        </header>

        <div className="drawer-body">
          {cart.msg && <p className="err">{cart.msg}</p>}
          {!cart.loaded && <p className="muted">Cargando carrito...</p>}
          {cart.loaded && lines.length === 0 && (
            <div className="drawer-empty">
              <p>Tu carrito esta vacio.</p>
              <button className="btn-primary" onClick={cart.close}>Seguir comprando</button>
            </div>
          )}

          {lines.map((i) => {
            const hasDesc = (i.discount || 0) > 0
            const orig = i.price * i.qty
            const final = orig * (1 - (i.discount || 0) / 100)
            const open = !!openLines[i.id]
            return (
              <div key={i.id} className="drawer-line">
                <PImg product={i} size={56} />
                <div className="grow">
                  <div className="drawer-name">{i.name}</div>
                  {hasDesc ? (
                    <button className="price-btn" title="Clic para ver el desglose"
                            onClick={() => setOpenLines((o) => ({ ...o, [i.id]: !o[i.id] }))}>
                      ${final.toFixed(2)} {open ? '▲' : '▼'}
                    </button>
                  ) : (
                    <div className="drawer-price">${orig.toFixed(2)}</div>
                  )}
                  {hasDesc && open && (
                    <div className="breakdown">
                      <div>Precio: ${orig.toFixed(2)}</div>
                      <div>Descuento {i.discount}%: −${(orig - final).toFixed(2)}</div>
                      <div><b>Queda en: ${final.toFixed(2)}</b></div>
                    </div>
                  )}
                  <div className="qty-row">
                    <button className="qty-btn" onClick={() => cart.dec(i).catch((e) => cart.setMsg(e.message))} title="Quitar uno">−</button>
                    <span className="qty-num">{i.qty}</span>
                    <button className="qty-btn" onClick={() => cart.add(i).catch((e) => cart.setMsg(e.message))} title="Agregar uno mas">+</button>
                    <button className="link-btn" onClick={() => cart.removeLine(i).catch((e) => cart.setMsg(e.message))}>Quitar todo</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {lines.length > 0 && cart.preview && (
          <footer className="drawer-foot">
            <div className="totals">
              <div><span>Subtotal</span><b>${cart.preview.subtotal}</b></div>
              <div className="tot-disc"><span>Descuento{cart.preview.detalle ? ` (${cart.preview.detalle})` : ''}</span><b>−${cart.preview.discount}</b></div>
              <div><span>IVA 16%</span><b>${cart.preview.iva}</b></div>
              <div className="tot-total"><span>Total</span><b>${cart.preview.total}</b></div>
            </div>
            <button className="btn-pay pay-full" onClick={() => { setPayErr(''); setShowPay(true) }}>
              Pagar ${cart.preview.total}
            </button>
            <button className="link-btn clear-link" onClick={() => cart.clear().catch((e) => cart.setMsg(e.message))}>
              Vaciar carrito
            </button>
          </footer>
        )}

        {showPay && cart.preview && (
          <PayPopup user={user} preview={cart.preview}
                    lines={lines.map((i) => ({ product: i.name, qty: i.qty, unit_price: i.price }))}
                    busy={busy} error={payErr}
                    onClose={() => setShowPay(false)} onPay={doPay} />
        )}
      </aside>
    </div>
  )
}
