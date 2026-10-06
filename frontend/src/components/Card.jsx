import React from 'react'

export function Card({ title, value, detail }) {
  return (
    <div style={styles.card}>
      <small style={styles.title}>{title}</small>
      <div style={styles.value}>{value}</div>
      <small style={styles.detail}>{detail}</small>
    </div>
  )
}

const styles = {
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, minWidth: 200, flex: 1 },
  title: { color: '#6b7280' },
  value: { fontSize: 26, fontWeight: 700, margin: '6px 0' },
  detail: { color: '#059669' }
}
