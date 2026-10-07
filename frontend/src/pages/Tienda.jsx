import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { checkout, fetchAvailable, fetchTicket } from '../services/api.js'
import { Shop } from '../components/Shop.jsx'
import { CartDrawer } from '../components/CartDrawer.jsx'
import { Ticket } from '../components/Ticket.jsx'

// Tienda: catalogo publico (solo existencias). Comprar exige cuenta de cliente.
export function Tienda({ go, openAuth }) {
  const { user, markFirstPurchaseDone } = useAuth()
  const cart = useCart()
  const [products, setProducts] = useState([])
  const [ticket, setTicket] = useState(null)
  const [ticketLines, setTicketLines] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => fetchAvailable()
    .then((d) => setProducts(Array.isArray(d) ? d : []))
    .catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [])
  // El carrito global refresca el catalogo tras cada operacion
  useEffect(() => { cart.registerChange(refresh) }, []) // eslint-disable-line
  // Catalogo para el drawer (miniaturas/nombres de las lineas)
  useEffect(() => { cart.setCatalog(products) }, [products]) // eslint-disable-line

  const pay = async (items, pay_method) => {
    setError(''); setBusy(true)
    try {
      const sale = await checkout(items, undefined, pay_method)
      const t = await fetchTicket(sale.id)
      setTicket(t)
      setTicketLines(t.items)
      if (sale.discount > 0) markFirstPurchaseDone()
      refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="page-full">
      <section className="hero">
        <div>
          <h2>Mini-Market</h2>
          <p className="muted">Frescos y abarrotes a un clic. Solo productos en existencia.</p>
        </div>
        <div className="hero-badges">
          <span className="cat-badge cat-alimentos">Alimentos</span>
          <span className="cat-badge cat-bebidas">Bebidas</span>
          <span className="cat-badge cat-higiene">Higiene</span>
          <span className="cat-badge cat-lacteos">Lacteos</span>
        </div>
      </section>
      {user?.role === 'cliente' && !user.first_purchase_done && (
        <p className="promo">Tu primera compra como cliente registrado tiene 15% de descuento automatico.</p>
      )}
      {error && <p className="err">{error}</p>}
      <Shop products={products} openAuth={openAuth} />
      <CartDrawer onCheckout={pay} busy={busy} />
      {ticket && (
        <div className="modal-overlay">
          <div className="modal modal-ticket" role="dialog" aria-modal="true">
            <button type="button" className="auth-x" title="Cerrar"
                    onClick={() => setTicket(null)}>X</button>
            <Ticket sale={ticket} lines={ticketLines} />
          </div>
        </div>
      )}
    </div>
  )
}
