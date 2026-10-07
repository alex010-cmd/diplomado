import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { CartProvider, useCart } from './context/CartContext.jsx'
import { Tienda } from './pages/Tienda.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { ProfilePopup } from './components/ProfilePopup.jsx'
import { AuthPopup } from './components/AuthPopup.jsx'
import { Privacy, Terms } from './pages/Legal.jsx'

// Icono de carrito (SVG, sin emoji) con badge animado de piezas.
function CartButton({ onClick }) {
  const cart = useCart()
  return (
    <button className="cart-btn" onClick={onClick} title="Carrito de compras"
            aria-label={`Carrito, ${cart.count} piezas`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round"
           strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {cart.count > 0 && (
        <span key={cart.count} className="cart-badge">{cart.count}</span>
      )}
    </button>
  )
}

function Shell() {
  const { isAuth, user, logout, updateUser } = useAuth()
  const cart = useCart()
  const [view, setView] = useState('tienda')
  const [showProfile, setShowProfile] = useState(false)
  const [authCfg, setAuthCfg] = useState(null)
  const go = (v) => { setView(v); window.scrollTo(0, 0) }
  // EL popup unico de acceso: toda accion de entrar/registrarse lo abre.
  const openAuth = (cfg) => setAuthCfg({ tab: 'login', ...(cfg || {}) })
  const isClient = !isAuth || user?.role === 'cliente'
  const onCart = () => {
    if (!isAuth) { openAuth({ tab: 'login' }); return }
    cart.toggle()
  }

  const main = (() => {
    if (view === 'privacy') return <Privacy go={go} />
    if (view === 'terms') return <Terms go={go} />
    if (view === 'dashboard' && isAuth) return <Dashboard go={go} />
    return <Tienda go={go} openAuth={openAuth} />
  })()

  return (
    <div className="app-shell">
      <header className="topbar">
        <b className="brand" onClick={() => go('tienda')}>Mini<span>-Market</span></b>
        <span className="navlinks">
          <button onClick={() => go('tienda')}>Tienda</button>
          {isClient && <CartButton onClick={onCart} />}
          {isAuth ? (
            <>
              <button onClick={() => go('dashboard')}>Mi panel ({user?.role})</button>
              <button onClick={() => setShowProfile(true)} title="Mi perfil">Engrane</button>
              <button onClick={() => { logout(); cart.close(); go('tienda') }}>Salir</button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth({ tab: 'login', onSuccess: () => go('dashboard') })}>Entrar</button>
              <button onClick={() => openAuth({ tab: 'register', onSuccess: () => go('dashboard') })}>Crear cuenta</button>
            </>
          )}
        </span>
      </header>
      {main}
      {authCfg && (
        <AuthPopup initial={authCfg.tab}
          onClose={() => setAuthCfg(null)}
          onSuccess={() => { const f = authCfg.onSuccess; setAuthCfg(null); f && f() }} />
      )}
      {showProfile && isAuth && (
        <ProfilePopup onClose={() => setShowProfile(false)}
          onUpdated={(me) => updateUser({ full_name: me.full_name, email: me.email })} />
      )}
      <footer className="foot">
        <button onClick={() => go('privacy')}>Politica de Privacidad</button>
        {' · '}
        <button onClick={() => go('terms')}>Terminos y Condiciones</button>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Shell />
      </CartProvider>
    </AuthProvider>
  )
}
