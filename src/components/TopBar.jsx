export default function TopBar({ title, subtitle, onBack }) {
  return (
    <div style={{
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
      borderBottom: '0.5px solid #2a2a2a', flexShrink: 0, background: '#111'
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          background: '#2a2a2a', border: 'none', borderRadius: '50%',
          width: '32px', height: '32px', color: '#fff', fontSize: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>‹</button>
      )}
      <div>
        <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{title}</div>
        {subtitle && <div style={{ color: '#555', fontSize: '11px', marginTop: '1px' }}>{subtitle}</div>}
      </div>
    </div>
  )
}
