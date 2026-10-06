import React, { useState } from 'react'
import { detectBrand, getMemoryCard, saveMemoryCard } from '../services/cards.js'

const METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta_debito', label: 'Tarjeta de debito' },
  { id: 'tarjeta_credito', label: 'Tarjeta de credito' },
  { id: 'transferencia', label: 'Transferencia' }
]

// Popup de pago: muestra el ticket, pide metodo de pago y, si es tarjeta,
// exige confirmar una alerta de PRUEBA antes de continuar.
// La tarjeta JAMAS sale de esta pantalla hacia el servidor.
export function PayPopup({ user, preview, lines, busy, error, onClose, onPay }) {
  const [method, setMethod] = useState('efectivo')
  const [card, setCard] = useState('')
  const [cardName, setCardName] = useState(user?.full_name || '')
  const [ackTest, setAckTest] = useState(false)
  const [saveCard, setSaveCard] = useState(false)
  const [localErr, setLocalErr] = useState('')

  const memCard = user ? getMemoryCard(`u:${user.username}`) : null
  const digits = card.replace(/\D/g, '')
  const isCard = method === 'tarjeta_debito' || method === 'tarjeta_credito'

  const format = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')

  const pay = async () => {
    setLocalErr('')
    // Con tarjeta SIEMPRE se exige confirmar el aviso de prueba.
    if (isCard && !ackTest) {
      setLocalErr('Debes confirmar el aviso de pagina de prueba.'); return
    }
    let last4 = memCard && !digits ? memCard.last4 : null
    if (isCard && !last4) {
      if (digits.length < 12 || digits.length > 19) {
        setLocalErr('Numero de tarjeta invalido (demo).'); return
      }
      last4 = digits.slice(-4)
      if (saveCard && user) {
        saveMemoryCard(`u:${user.username}`,
          { last4, brand: detectBrand(digits), holderName: cardName })
      }
    }
    await onPay({ pay_method: method, cardLast4: last4 })
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h3>Ticket de compra</h3>
        <pre style={s.pre}>
          {lines.map((l) => `${l.product} x${l.qty} = $${(l.unit_price * l.qty).toFixed(2)}`).join('\n')}
          {'\n--------------------------------\n'}
          Subtotal: ${preview.subtotal}{'\n'}
          Descuento: ${preview.discount}{preview.detalle ? ` (${preview.detalle})` : ''}{'\n'}
          IVA 16%: ${preview.iva}{'\n'}
          TOTAL: ${preview.total}
        </pre>

        <h4>Metodo de pago</h4>
        {METHODS.map((m) => (
          <label key={m.id} style={{ display: 'block' }}>
            <input type="radio" checked={method === m.id} onChange={() => setMethod(m.id)} /> {m.label}
          </label>
        ))}

        {isCard && (
          <div style={s.cardBox}>
            {memCard && !digits && (
              <p style={s.ok}>Usaras tu tarjeta guardada en memoria: {memCard.brand} terminacion {memCard.last4} (se borra al recargar).</p>
            )}
            <label>Numero de tarjeta (demo)
              <input value={card} onChange={(e) => setCard(format(e.target.value))}
                     placeholder="0000 0000 0000 0000" inputMode="numeric" />
            </label>
            <label>Nombre del titular
              <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Como aparece en la tarjeta" />
            </label>
            <div style={s.alert}>
              <b>AVISO IMPORTANTE — PAGINA DE PRUEBA.</b> Este sistema es un
              prototipo escolar sin procesamiento real de pagos. <b>Por ningun
              motivo ingreses informacion real de tarjetas.</b> Usa solo numeros
              de demostracion. Si marcas guardar, la tarjeta vive unicamente en
              la memoria de esta pestana y <b>se borra al recargar la pagina</b>;
              nunca se envia al servidor ni se guarda en la base de datos.
            </div>
            <label style={s.check}>
              <input type="checkbox" checked={ackTest} onChange={(e) => setAckTest(e.target.checked)} />
              Entiendo que es una pagina de prueba y no usare datos reales.
            </label>
            {user && (
              <label style={s.check}>
                <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
                Guardar tarjeta en memoria para futuras compras (se borra al recargar).
              </label>
            )}
          </div>
        )}

        {(localErr || error) && <p style={s.err}>{localErr || error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={busy} onClick={pay}>
            {busy ? 'Procesando...' : `Pagar $${preview.total}`}
          </button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
             display: 'grid', placeItems: 'center', zIndex: 50, padding: 12 },
  modal: { background: '#fff', borderRadius: 14, padding: 20, maxWidth: 480,
           width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  pre: { background: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' },
  cardBox: { display: 'grid', gap: 8, marginTop: 8 },
  alert: { background: '#fef3c7', border: '2px solid #d97706', borderRadius: 8, padding: 10 },
  check: { display: 'flex', gap: 6, alignItems: 'flex-start' },
  err: { background: '#fee2e2', padding: 8, borderRadius: 8 },
  ok: { background: '#dcfce7', padding: 8, borderRadius: 8 }
}
