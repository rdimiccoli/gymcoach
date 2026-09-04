import { IconaHome, IconaSchede, IconaTurni, IconaAtleti, IconaImpostazioni } from './Icone'
export default function BottomNav({ active, navigate, goHome }) {
  const items = [
    { id: 'home',     Icona: IconaHome,          label: 'HOME',    action: goHome },
    { id: 'cycles',   Icona: IconaSchede,        label: 'SCHEDE',  action: () => navigate('cycles') },
    { id: 'turns',    Icona: IconaTurni,         label: 'TURNI',   action: () => navigate('turns') },
    { id: 'athletes', Icona: IconaAtleti,        label: 'ATLETI',  action: () => navigate('athletes') },
    { id: 'settings', Icona: IconaImpostazioni,  label: 'IMPOST.', action: () => navigate('settings') },
  ]
  return (
    <div style={{
      background: 'rgba(10,10,10,0.98)',
      borderTop: '1px solid var(--sup-alta)',
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
              width: '28px', height: '3px', background: 'var(--accento)', borderRadius: '0 0 3px 3px'
            }} />
          )}
          <div style={{ color: active === item.id ? 'var(--accento)' : '#4a4643', display: 'flex', lineHeight: 1 }}>
            <item.Icona />
          </div>
          <div style={{
            fontSize: '13px',
            letterSpacing: '0.5px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: '700',
            color: active === item.id ? 'var(--accento)' : '#555',
            textAlign: 'center',
            lineHeight: 1,
          }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
