import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchDashboard } from '../services/api.js'
import { Card } from '../components/Card.jsx'

export function Dashboard() {
  const { user, token, logout } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboard(token).then(setData).catch(e => setError(e.message))
  }, [token])

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <div>
          <h2 style={{ margin: 0 }}>Dashboard protegido</h2>
          <small>{user?.full_name} ({user?.role}) - JWT valido</small>
        </div>
        <button onClick={logout}>Cerrar sesion</button>
      </header>
      {error && <p style={s.err}>{error}</p>}
      <div style={s.grid}>
        {(data?.kpis || []).map(k => (
          <Card key={k.titulo} title={k.titulo} value={k.valor} detail={k.detalle} />
        ))}
      </div>
      {data && (
        <pre style={s.pre}>{JSON.stringify(data.arquitectura, null, 2)}</pre>
      )}
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', background: '#f1f5f9', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  grid: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  err: { background: '#fee2e2', padding: 10, borderRadius: 8 },
  pre: { background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 12, marginTop: 16 }
}
