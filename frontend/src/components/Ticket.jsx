import React from 'react'

// Ticket de compra: se muestra en pantalla y se puede descargar/imprimir.
export function ticketText(sale, lines) {
  const L = []
  L.push('========== MINI-MARKET ==========')
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
  L.push('Gracias por su compra')
  return L.join('\n')
}

const PAY_LABELS = { efectivo: 'Efectivo', tarjeta_debito: 'Tarjeta de debito',
  tarjeta_credito: 'Tarjeta de credito', transferencia: 'Transferencia' }
const payLabel = (m) => PAY_LABELS[m] || 'Efectivo'

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
    w.document.write(`<pre>${txt.replace(/</g, '&lt;')}</pre>`)
    w.document.close()
    w.print()
  }

  return (
    <div style={s.box}>
      <h3>Ticket #{sale.id}</h3>
      <pre style={s.pre}>{txt}</pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={download}>Descargar ticket</button>
        <button onClick={print}>Imprimir</button>
      </div>
      {sale.discount > 0 && <small>Se aplico 15% por primera compra de cliente registrado.</small>}
    </div>
  )
}

const s = {
  box: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, maxWidth: 420 },
  pre: { background: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }
}
