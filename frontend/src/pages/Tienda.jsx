import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { checkout, fetchAvailable, fetchTicket, getHolder } from '../services/api.js'
import { Shop } from '../components/Shop.jsx'
import { Ticket } from '../components/Ticket.jsx'

// Tienda publica: invitado o cliente. Solo existencias.
// Invitado paga sin descuento y se le invita a registrarse.
export function Tienda({ go }) {
  const { token, user, markFirstPurchaseDone } = useAuth()
  const [products, setProducts] = useState([])
  const [ticket, setTicket] = useState(null)
  const [ticketLines, setTicketLines] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => fetchAvailable().then(setProducts).catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [])

  const pay = async (items, buyerName, holder, pay_method) => {
    setError(''); setBusy(true)
    const guestLines = items.map(({ product_id, qty }) => {
      const p = products.find((x) => x.id === product_id)
      return { product: p.name, qty, unit_price: p.price }
    })
    try {
      const sale = await checkout(items, buyerName || user?.username || 'invitado',
                                  token || undefined, holder || getHolder(user),
                                  pay_method || 'efectivo')
      const t = token ? await fetchTicket(token, sale.id) : null
      setTicket(t || { ...sale, created_at: new Date().toLocaleString() })
      setTicketLines(t ? t.items : guestLines)
      if (sale.discount > 0) markFirstPurchaseDone()
      refresh()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={s.wrap}>
      <h2>Tienda — solo productos en existencia</h2>
      {!user && <p>Compra como invitado (sin descuento) o <button onClick={() => go('register')}>registrate</button> y tu primera compra lleva 15%.</p>}
      {user?.role === 'cliente' && !user.first_purchase_done && (
        <p style={s.promo}>Tu primera compra como cliente registrado tiene 15% de descuento automatico.</p>
      )}
      {error && <p style={s.err}>{error}</p>}
      <Shop user={user} token={token} products={products}
            onCheckout={pay} busy={busy} onStockChange={refresh} />
      {ticket && (
        <div style={{ marginTop: 16 }}>
          <h3>Compra exitosa</h3>
          <Ticket sale={ticket} lines={ticketLines} />
          {!user && (
            <p>¿Quieres 15% en tu proxima primera compra registrada? <button onClick={() => go('register')}>Crear cuenta</button></p>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { padding: 24, background: '#f1f5f9', minHeight: '100vh' },
  err: { background: '#fee2e2', padding: 8, borderRadius: 8 },
  promo: { background: '#dcfce7', padding: 8, borderRadius: 8 }
}
