export default function BottomNav({ active, navigate, goHome }) {
  const items = [
    { id: 'home', icon: '🏠', label: 'Oggi', action: goHome },
    { id: 'cycles', icon: '📚', label: 'Cicli', action: () => navigate('cycles') },
    { id: 'settings', icon: '⚙️', label: 'Impost.', action: () => navigate('settings') },
  ]
  return (
    <div style={{
      background: '#161616', borderTop: '0.5px solid #2a2a2a',
      padding: '8px 0 20px', display: 'flex', justifyContent: 'space-around', flexShrink: 0
    }}>
      {items.map(item => (
        <div key={item.id} onClick={item.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '0 20px', cursor: 'pointer' }}>
          <div style={{ fontSize: '18px' }}>{item.icon}</div>
          <div style={{ fontSize: '9px', color: active === item.id ? '#D95C1A' : '#444' }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
