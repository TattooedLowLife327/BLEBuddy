export function PreviewIndex() {
  const links = [
    { label: '01 Preview (Local)', path: '/preview/01' },
    { label: 'Cricket Preview (Local)', path: '/preview/cr' },
    { label: 'Cork Preview', path: '/preview/cork' },
    { label: '01 Preview (Online Background)', path: '/preview/01-online' },
    { label: 'Cricket Preview (Online Background)', path: '/preview/cr-online' },
    { label: '01 Inhouse (Live Screen)', path: '/game/01-inhouse' },
    { label: 'Cricket Inhouse (Live Screen)', path: '/game/cricket-inhouse' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070707',
      color: '#fff',
      padding: '32px 20px',
      fontFamily: 'Helvetica, Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Preview Index</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: 24 }}>
          Click any preview to open it in a new tab.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {links.map(link => (
            <a
              key={link.path}
              href={link.path}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              <span>{link.label}</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{link.path}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PreviewIndex;
