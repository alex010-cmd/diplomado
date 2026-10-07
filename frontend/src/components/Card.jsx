import React from 'react'

export function Card({ title, value, detail }) {
  return (
    <div className="kpi-card">
      <small>{title}</small>
      <div className="big">{value}</div>
      <small>{detail}</small>
    </div>
  )
}
