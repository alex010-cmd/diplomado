import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { Login } from './pages/Login.jsx'
import { Register } from './pages/Register.jsx'
import { Tienda } from './pages/Tienda.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { Settings } from './pages/Settings.jsx'
import { Privacy, Terms } from './pages/Legal.jsx'

function Shell() {
  const { isAuth, user, logout } = useAuth()
  const [view, setView] = useState('tienda')
  const go = (v) => { setView(v); window.scrollTo(0, 0) }

  const main = (() => {
    if (view === 'login') return <Login go={go} />
    if (view === 'register') return <Register go={go} />
    if (view === 'privacy') return <Privacy go={go} />
    if (view === 'terms') return <Terms go={go} />
    if (view === 'settings' && isAuth) return <Settings />
    if (view === 'dashboard' && isAuth) return <Dashboard go={go} />
    return <Tienda go={go} />
  })()

  // Si inicia sesion, llevarlo a su dashboard
  React.useEffect(() => { if (isAuth && (view === 'login' || view === 'register')) setView('dashboard') }, [isAuth])

  return (
    <div>
      <header style={s.nav}>
        <b style={{ cursor: 'pointer' }} onClick={() => go('tienda')}>Mini-Market</b>
        <span style={s.links}>
          <button onClick={() => go('tienda')}>Tienda</button>
          {isAuth ? (
            <>
              <button onClick={() => go('dashboard')}>Mi panel ({user?.role})</button>
              <button onClick={() => go('settings')} title="Ajustes">Engrane</button>
              <button onClick={() => { logout(); go('tienda') }}>Salir</button>
            </>
          ) : (
            <>
              <button onClick={() => go('login')}>Entrar</button>
              <button onClick={() => go('register')}>Crear cuenta</button>
            </>
          )}
        </span>
      </header>
      {main}
      <footer style={s.foot}>
        <button onClick={() => go('privacy')}>Politica de Privacidad</button>
        {' · '}
        <button onClick={() => go('terms')}>Terminos y Condiciones</button>
      </footer>
    </div>
  )
}

const s = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
         padding: '10px 16px', background: '#0f172a', color: '#fff' },
  links: { display: 'flex', gap: 8 },
  foot: { padding: 16, textAlign: 'center', background: '#f1f5f9' }
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
