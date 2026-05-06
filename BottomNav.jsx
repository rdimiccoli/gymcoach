export default function BottomNav({ active, navigate, goHome }) {
  const items = [
    { id: 'home', icon: '⬡', label: 'HOME', action: goHome },
    { id: 'cycles', icon: '◈', label: 'CICLI', action: () => navigate('cycles') },
    { id: 'settings', icon: '◎', label: 'SETUP', action: () => navigate('settings') },
  ]
  return (
    <div style={{
      background: 'rgba(10,10,10,0.97)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '10px 0 22px',
      display: 'flex',
      justifyContent: 'space-around',
      flexShrink: 0,
      backdropFilter: 'blur(20px)',
    }}>
      {items.map(item => (
        <div key={item.id} onClick={item.action} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '4px', padding: '6px 24px', cursor: 'pointer', position: 'relative'
        }}>
          {active === item.id && (
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '20px', height: '2px', background: '#D95C1A', borderRadius: '0 0 2px 2px' }} />
          )}
          <div style={{ fontSize: '17px', color: active === item.id ? '#D95C1A' : '#333' }}>{item.icon}</div>
          <div style={{
            fontSize: '9px', letterSpacing: '1.5px',
            fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700',
            color: active === item.id ? '#D95C1A' : '#333'
          }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
