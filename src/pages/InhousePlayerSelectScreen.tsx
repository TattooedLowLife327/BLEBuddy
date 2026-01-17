import { useNavigate, useSearchParams } from 'react-router-dom';

interface PlayerData {
  id: string;
  name: string;
  profilePic?: string;
  profileColor: string;
}

interface InhousePlayerSelectScreenProps {
  player1: PlayerData;
  gameType: 'cricket' | '301' | '501' | '701';
  onBack: () => void;
}

const FONT_NAME = "'Helvetica Condensed', sans-serif";

export function InhousePlayerSelectScreen({
  player1,
  gameType,
  onBack,
}: InhousePlayerSelectScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const gameLabel = gameType === 'cricket' ? 'CRICKET' : gameType;

  const handleSoloPlay = () => {
    // Navigate to game with solo mode (no player 2)
    if (gameType === 'cricket') {
      navigate(`/game/cricket-inhouse?mode=solo${searchParams.get('dev') ? '&dev=1' : ''}`);
    } else {
      navigate(`/game/01-inhouse?type=${gameType}&mode=solo${searchParams.get('dev') ? '&dev=1' : ''}`);
    }
  };

  const handleVsGuest = () => {
    // Navigate to game with guest mode (player 2 is a guest)
    if (gameType === 'cricket') {
      navigate(`/game/cricket-inhouse?mode=guest${searchParams.get('dev') ? '&dev=1' : ''}`);
    } else {
      navigate(`/game/01-inhouse?type=${gameType}&mode=guest${searchParams.get('dev') ? '&dev=1' : ''}`);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: '#000000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, ${player1.profileColor}15 0%, transparent 60%)`,
        }}
      />

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          padding: '12px 24px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 8,
          color: '#fff',
          fontFamily: FONT_NAME,
          fontSize: 16,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        BACK
      </button>

      {/* Game type header */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 32px',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: 8,
          border: `1px solid ${player1.profileColor}40`,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: FONT_NAME,
            fontWeight: 700,
            fontSize: 24,
            color: '#FFFFFF',
            letterSpacing: 2,
          }}
        >
          {gameLabel}
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          zIndex: 5,
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: FONT_NAME,
            fontSize: 32,
            fontWeight: 300,
            color: '#FFFFFF',
            letterSpacing: 4,
            marginBottom: 16,
          }}
        >
          SELECT PLAYERS
        </h1>

        {/* Player 1 info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 32px',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: `2px solid ${player1.profileColor}`,
            boxShadow: `0 0 30px ${player1.profileColor}40`,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: `3px solid ${player1.profileColor}`,
              background: '#000',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {player1.profilePic ? (
              <img
                src={player1.profilePic}
                alt={player1.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: player1.profileColor, fontSize: 24, fontWeight: 700 }}>
                {player1.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontFamily: FONT_NAME, fontSize: 20, fontWeight: 600, color: '#fff' }}>
              {player1.name}
            </div>
            <div style={{ fontFamily: FONT_NAME, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              PLAYER 1
            </div>
          </div>
        </div>

        {/* Selection options */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginTop: 24,
            width: 320,
          }}
        >
          {/* Solo Practice */}
          <button
            onClick={handleSoloPlay}
            style={{
              padding: '24px 32px',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = player1.profileColor;
              e.currentTarget.style.boxShadow = `0 0 20px ${player1.profileColor}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
            <span style={{ fontFamily: FONT_NAME, fontSize: 20, fontWeight: 600, color: '#fff' }}>
              SOLO PRACTICE
            </span>
            <span style={{ fontFamily: FONT_NAME, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              Practice by yourself
            </span>
          </button>

          {/* VS Guest */}
          <button
            onClick={handleVsGuest}
            style={{
              padding: '24px 32px',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = player1.profileColor;
              e.currentTarget.style.boxShadow = `0 0 20px ${player1.profileColor}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <circle cx="9" cy="7" r="3" />
              <circle cx="15" cy="7" r="3" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h2" />
              <path d="M15 15a4 4 0 0 1 4 4v2" />
              <path d="M12 12v9" />
            </svg>
            <span style={{ fontFamily: FONT_NAME, fontSize: 20, fontWeight: 600, color: '#fff' }}>
              VS GUEST
            </span>
            <span style={{ fontFamily: FONT_NAME, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              Play against a local guest
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default InhousePlayerSelectScreen;
