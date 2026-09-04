export default function TopBar({ title, subtitle, onBack }) {
  return (
    <div style={{
      padding: '10px 18px 10px',
      display: 'flex', alignItems: 'center', gap: '12px',
      borderBottom: '1px solid var(--sup-alta)',
      flexShrink: 0,
      background: 'rgba(10,10,10,0.95)',
      backdropFilter: 'blur(20px)',
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          background: 'var(--sup-alta)',
          border: '1px solid var(--sup-alta)',
          borderRadius: '3px',
          width: '34px', height: '34px',
          color: '#fff', fontSize: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>‹</button>
      )}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: '20px', fontWeight: '700',
          color: '#fff', letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>{title}</div>
        {subtitle && <div style={{ color: 'var(--testo-debole)', fontSize: '11px', marginTop: '1px', letterSpacing: '0.5px' }}>{subtitle}</div>}
      </div>
      <img src="/logo_OAD.png" alt="OAD" style={{ height: '32px', mixBlendMode: 'screen', flexShrink: 0, opacity: 0.85 }} />
    </div>
  )
}
