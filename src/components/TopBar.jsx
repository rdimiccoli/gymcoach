export default function TopBar({ title, subtitle, onBack }) {
  return (
    <div style={{
      padding: '12px 18px 10px',
      display: 'flex', alignItems: 'center', gap: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
      background: 'rgba(10,10,10,0.95)',
      backdropFilter: 'blur(20px)',
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '3px',
          width: '34px', height: '34px',
          color: '#fff', fontSize: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>‹</button>
      )}
      <div>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: '20px', fontWeight: '700',
          color: '#fff', letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>{title}</div>
        {subtitle && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '1px', letterSpacing: '0.5px' }}>{subtitle}</div>}
      </div>
    </div>
  )
}
