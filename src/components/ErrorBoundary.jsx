import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('App error:', error, info) }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--fondo)', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }}>QUALCOSA È ANDATO STORTO</div>
        <div style={{ color: 'var(--testo-debole)', fontSize: '12px', marginBottom: '8px' }}>{this.state.error?.message}</div>
        <button onClick={() => window.location.reload()}
          style={{ background: 'var(--accento)', border: 'none', borderRadius: '6px', padding: '14px 28px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '2px', cursor: 'pointer', marginTop: '16px' }}>
          RICARICA APP
        </button>
      </div>
    )
  }
}
