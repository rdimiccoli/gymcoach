export default function BottomNav({ active, navigate, goHome }) {
  const items = [
    { id: 'home',     icon: '⬡', label: 'HOME',         action: goHome },
    { id: 'cycles',   icon: '◈', label: 'SCHEDE',        action: () => navigate('cycles') },
    { id: 'turns',    icon: '◷', label: 'TURNI',         action: () => navigate('turns') },
    { id: 'settings', icon: '◎', label: 'IMPOST.',       action: () => navigate('settings') },
  ]
  return (
    <div style={{
      background: 'rgba(10,10,10,0.98)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '10px 0 28px',
      display: 'flex',
      justifyContent: 'space-around',
      flexShrink: 0,
    }}>
      {items.map(item => (
        <div key={item.id} onClick={item.action} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '5px', padding: '4px 8px', cursor: 'pointer', position: 'relative',
          flex: 1, minWidth: 0,
        }}>
          {active === item.id && (
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '28px', height: '3px', background: '#D95C1A', borderRadius: '0 0 3px 3px'
            }} />
          )}
          <div style={{ fontSize: '24px', color: active === item.id ? '#D95C1A' : '#444', lineHeight: 1 }}>
            {item.icon}
          </div>
          <div style={{
            fontSize: '11px',
            letterSpacing: '0.5px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: '700',
            color: active === item.id ? '#D95C1A' : '#555',
            textAlign: 'center',
            lineHeight: 1,
          }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
