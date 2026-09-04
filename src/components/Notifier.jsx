import { useState, useEffect } from 'react'
import { subscribe } from '../lib/notify'

export default function Notifier() {
  const [messages, setMessages] = useState([])

  useEffect(() => subscribe(msg => {
    setMessages(prev => [...prev, msg])
    setTimeout(() => setMessages(prev => prev.filter(m => m.id !== msg.id)), 4500)
  }), [])

  if (!messages.length) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
      {messages.map(m => (
        <div key={m.id} onClick={() => setMessages(prev => prev.filter(x => x.id !== m.id))}
          style={{
            background: m.type === 'error' ? 'rgba(35,12,12,0.97)' : 'rgba(12,28,16,0.97)',
            border: `1px solid ${m.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
            borderRadius: '8px', padding: '12px 14px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', gap: '10px',
            pointerEvents: 'auto', cursor: 'pointer',
          }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>{m.type === 'error' ? '⚠️' : '✓'}</span>
          <span style={{
            color: m.type === 'error' ? '#fca5a5' : '#86efac',
            fontSize: '14px', lineHeight: 1.35, flex: 1,
          }}>{m.text}</span>
        </div>
      ))}
    </div>
  )
}
