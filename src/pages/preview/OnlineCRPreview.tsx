export function OnlineCRPreview() {
  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: '#000000',
      overflow: 'hidden',
    }}>
      {/* Split-screen placeholder backgrounds */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{
          flex: 1,
          position: 'relative',
          background: 'linear-gradient(135deg, #111 0%, #1f1f1f 100%)',
          borderRight: '2px solid rgba(255, 255, 255, 0.2)',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.25)',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 28,
            letterSpacing: 2,
          }}>
            YOU
          </div>
        </div>
        <div style={{
          flex: 1,
          position: 'relative',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          borderLeft: '2px solid rgba(255, 255, 255, 0.2)',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.25)',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 28,
            letterSpacing: 2,
          }}>
            OPPONENT
          </div>
        </div>
      </div>

      {/* UI overlay hint */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
      }} />
    </div>
  );
}

export default OnlineCRPreview;
