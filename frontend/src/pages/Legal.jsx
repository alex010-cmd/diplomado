import React from 'react'

export function Privacy({ go }) {
  return (
    <div className="page"><div className="card">
      <h2>Politica de Privacidad</h2>
      <p>Mini-Market recaba unicamente los datos necesarios para operar la tienda:
      nombre, correo electronico, direccion de entrega e historial de compras.</p>
      <ul>
        <li>Las contrasenas se guardan con hash bcrypt; nadie las ve en claro.</li>
        <li>El correo se usa para identificar tu cuenta, tu historial y tus descuentos.</li>
        <li>La direccion solo se usa para la entrega de productos.</li>
        <li>No compartimos tus datos con terceros con fines publicitarios.</li>
        <li>Puedes pedir la correccion o eliminacion de tus datos en tu perfil o con el administrador.</li>
        <li>Las credenciales viajan cifradas por HTTPS y la sesion usa JWT en una cookie HttpOnly (el JavaScript de la pagina nunca puede leerla), con expiracion de 15 minutos.</li>
      </ul>
      <button className="btn-primary" onClick={() => go('tienda')}>Volver a la tienda</button>
    </div></div>
  )
}

export function Terms({ go }) {
  return (
    <div className="page"><div className="card">
      <h2>Terminos y Condiciones</h2>
      <ul>
        <li>Precios en MXN; el stock mostrado es la disponibilidad real al momento de agregar al carrito.</li>
        <li>Al agregar al carrito el producto se aparta 30 minutos; si no pagas, vuelve a disponibilidad.</li>
        <li>El 15% de descuento aplica solo a la primera compra de clientes registrados.</li>
        <li>Las compras de invitado no generan descuento ni historial.</li>
        <li>El ticket de compra es tu comprobante; puedes descargarlo al pagar. Los precios incluyen IVA 16% desglosado en el ticket.</li>
        <li>PAGINA DE PRUEBA: jamas ingreses datos reales de tarjetas. El pago con tarjeta es simulado y ninguna tarjeta se guarda en el servidor.</li>
        <li>El sistema avisa al administrador cuando un producto baja de 5 piezas; el reabastecimiento lo gestiona el administrador.</li>
        <li>El uso indebido de cuentas puede suspender el acceso.</li>
      </ul>
      <button className="btn-primary" onClick={() => go('tienda')}>Volver a la tienda</button>
    </div></div>
  )
}
