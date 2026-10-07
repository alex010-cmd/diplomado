import React from 'react'

const PAY_LABELS = { efectivo: 'Efectivo', tarjeta_debito: 'Tarjeta de debito',
  tarjeta_credito: 'Tarjeta de credito', transferencia: 'Transferencia' }
const payLabel = (m) => PAY_LABELS[m] || 'Efectivo'

// Ticket de compra: se muestra en pantalla y se puede descargar/imprimir.
export function ticketText(sale, lines) {
  const L = []
  L.push('================================')
  L.push('          MINI-MARKET           ')
  L.push('================================')
  L.push(`Ticket #${sale.id}   ${sale.created_at || ''}`)
  L.push(`Comprador: ${sale.buyer_name}`)
  L.push('--------------------------------')
  for (const it of lines) {
    L.push(`${it.product} x${it.qty}  $${it.unit_price} = $${(it.qty * it.unit_price).toFixed(2)}`)
  }
  L.push('--------------------------------')
  L.push(`Subtotal:  $${sale.subtotal}`)
  if (sale.detalle) L.push(`Descuentos: ${sale.detalle}`)
  L.push(`Descuento: $${sale.discount}`)
  L.push(`IVA 16%:   $${sale.iva || 0}`)
  L.push(`TOTAL:     $${sale.total}`)
  L.push(`Pago: ${payLabel(sale.pay_method)}`)
  L.push('================================')
  L.push('   Gracias por su compra <3')
  return L.join('\n')
}

function fmtDate(iso) {
  try { return iso ? new Date(iso).toLocaleString() : '' } catch { return '' }
}

export function Ticket({ sale, lines }) {
  const txt = ticketText(sale, lines)

  const download = () => {
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ticket-${sale.id}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const print = () => {
    const w = window.open('', '_blank')
    w.document.write(`<pre style="font-family:monospace">${txt.replace(/</g, '&lt;')}</pre>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="ticket">
      <div className="ticket-head">
        <div className="ticket-brand">Mini-Market</div>
        <div className="ticket-sub">Comprobante de compra</div>
        <div className="ticket-meta">
          <span>Ticket #{sale.id}</span>
          <span>{fmtDate(sale.created_at)}</span>
        </div>
        <div className="ticket-buyer">{sale.buyer_name}</div>
      </div>

      <div className="ticket-items">
        {lines.map((it, idx) => (
          <div key={idx} className="ticket-item">
            <div className="ti-name">{it.product}</div>
            <div className="ti-qty">{it.qty} x ${it.unit_price}</div>
            <div className="ti-amount">${(it.qty * it.unit_price).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="ticket-totals">
        <div><span>Subtotal</span><b>${sale.subtotal}</b></div>
        <div className="disc">
          <span>Descuento{sale.detalle ? ` · ${sale.detalle}` : ''}</span>
          <b>−${sale.discount}</b>
        </div>
        <div><span>IVA 16%</span><b>${sale.iva || 0}</b></div>
      </div>

      <div className="ticket-total">
        <span>TOTAL</span>
        <b>${sale.total}</b>
      </div>

      <div className="ticket-foot">
        <span className="pay-chip">{payLabel(sale.pay_method)}</span>
        <span className="ticket-thanks">Gracias por su compra</span>
      </div>

      <div className="ticket-actions no-print">
        <button className="btn-primary" onClick={download}>Descargar ticket</button>
        <button onClick={print}>Imprimir</button>
      </div>
      {sale.discount > 0 && (
        <small className="muted">Se aplico descuento automatico en esta compra.</small>
      )}
    </div>
  )
}
