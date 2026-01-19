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
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: '#000000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
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

      {/* Top bar with back button and game type */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          zIndex: 10,
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            padding: '10px 16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            color: '#fff',
            fontFamily: FONT_NAME,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          BACK
        </button>

        {/* Game type badge */}
        <div
          style={{
            padding: '10px 24px',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 8,
            border: `1px solid ${player1.profileColor}40`,
          }}
        >
          <span
            style={{
              fontFamily: FONT_NAME,
              fontWeight: 700,
              fontSize: 18,
              color: '#FFFFFF',
              letterSpacing: 2,
            }}
          >
            {gameLabel}
          </span>
        </div>

        {/* Spacer for balance */}
        <div style={{ width: 80 }} />
      </div>

      {/* Main content - centered */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          gap: 24,
          zIndex: 5,
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: FONT_NAME,
            fontSize: 24,
            fontWeight: 300,
            color: '#FFFFFF',
            letterSpacing: 4,
            margin: 0,
            opacity: 0,
            animation: 'fadeInDown 0.4s ease forwards',
          }}
        >
          SELECT MODE
        </h1>

        {/* Horizontal selection options */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 16,
            width: '100%',
            maxWidth: 400,
            justifyContent: 'center',
          }}
        >
          {/* Solo Practice */}
          <button
            onClick={handleSoloPlay}
            style={{
              flex: 1,
              padding: '20px 16px',
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
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = player1.profileColor;
              e.currentTarget.style.boxShadow = `0 0 20px ${player1.profileColor}40`;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
            <span style={{ fontFamily: FONT_NAME, fontSize: 16, fontWeight: 600, color: '#fff' }}>
              SOLO
            </span>
            <span style={{ fontFamily: FONT_NAME, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              Practice alone
            </span>
          </button>

          {/* VS Guest */}
          <button
            onClick={handleVsGuest}
            style={{
              flex: 1,
              padding: '20px 16px',
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
              opacity: 0,
              animation: 'fadeInUp 0.4s ease forwards 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = player1.profileColor;
              e.currentTarget.style.boxShadow = `0 0 20px ${player1.profileColor}40`;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <circle cx="9" cy="7" r="3" />
              <circle cx="15" cy="7" r="3" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h2" />
              <path d="M15 15a4 4 0 0 1 4 4v2" />
              <path d="M12 12v9" />
            </svg>
            <span style={{ fontFamily: FONT_NAME, fontSize: 16, fontWeight: 600, color: '#fff' }}>
              VS GUEST
            </span>
            <span style={{ fontFamily: FONT_NAME, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              Local 2-player
            </span>
          </button>
        </div>
      </div>

      {/* Bottom player bar with animation */}
      <div
        style={{
          padding: '16px',
          zIndex: 10,
          opacity: 0,
          animation: 'slideUpFade 0.5s ease forwards 0.3s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: `2px solid ${player1.profileColor}`,
            boxShadow: `0 0 30px ${player1.profileColor}40`,
          }}
        >
          {/* Avatar with pulse animation */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: `2px solid ${player1.profileColor}`,
              background: '#000',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: 'avatarPulse 2s ease-in-out infinite',
            }}
          >
            {player1.profilePic ? (
              <img
                src={player1.profilePic}
                alt={player1.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: player1.profileColor, fontSize: 20, fontWeight: 700 }}>
                {player1.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONT_NAME,
                fontSize: 18,
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {player1.name}
            </div>
            <div style={{ fontFamily: FONT_NAME, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              PLAYER 1
            </div>
          </div>
          {/* Ready indicator */}
          <div
            style={{
              padding: '6px 12px',
              background: `${player1.profileColor}20`,
              border: `1px solid ${player1.profileColor}`,
              borderRadius: 6,
              fontFamily: FONT_NAME,
              fontSize: 12,
              fontWeight: 600,
              color: player1.profileColor,
              letterSpacing: 1,
            }}
          >
            READY
          </div>
        </div>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes avatarPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 ${player1.profileColor}40;
          }
          50% {
            box-shadow: 0 0 0 8px ${player1.profileColor}00;
          }
        }
      `}</style>
    </div>
  );
}

export default InhousePlayerSelectScreen;
