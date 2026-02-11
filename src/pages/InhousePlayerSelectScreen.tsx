import { useNavigate, useSearchParams } from 'react-router-dom';

interface PlayerData {
  id: string;
  name: string;
  profilePic?: string;
  profileColor: string;
}

interface InhousePlayerSelectScreenProps {
  player1: PlayerData;
  gameType: 'cricket' | '301' | '501' | '701' | 'freeze' | 'count_up';
  onBack: () => void;
}

const FONT_NAME = "'Helvetica Condensed', sans-serif";

// Safe color alpha helper - handles hex, rgb(), hsl() formats
const withAlpha = (color: string, alpha: number): string => {
  if (!color) return `rgba(0, 0, 0, ${alpha})`;
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    let r, g, b;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0]+hex[0], 16);
      g = parseInt(hex[1]+hex[1], 16);
      b = parseInt(hex[2]+hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return `rgba(0, 0, 0, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  const hslMatch = c.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) return `hsla(${hslMatch[1].replace(/,\s*[\d.]+\s*$/, '')}, ${alpha})`;
  return `rgba(0, 0, 0, ${alpha})`;
};

export function InhousePlayerSelectScreen({
  player1,
  gameType,
  onBack,
}: InhousePlayerSelectScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const gameLabel = gameType === 'cricket' ? 'CRICKET' : gameType === 'freeze' ? 'FREEZE' : gameType === 'count_up' ? 'COUNT UP' : gameType;

  const cricketVariant = searchParams.get('variant') || undefined;

  const handleSoloPlay = () => {
    if (gameType === 'cricket') {
      const v = cricketVariant ? `&variant=${cricketVariant}` : '';
      navigate(`/game/cricket-inhouse?mode=solo${v}${searchParams.get('dev') ? '&dev=1' : ''}`);
    } else {
      navigate(`/game/01-inhouse?type=${gameType}&mode=solo${searchParams.get('dev') ? '&dev=1' : ''}`);
    }
  };

  const handleVsGuest = () => {
    if (gameType === 'cricket') {
      const v = cricketVariant ? `&variant=${cricketVariant}` : '';
      navigate(`/game/cricket-inhouse?mode=guest${v}${searchParams.get('dev') ? '&dev=1' : ''}`);
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
          background: `radial-gradient(circle at center, ${withAlpha(player1.profileColor, 0.08)} 0%, transparent 60%)`,
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
            border: `1px solid ${withAlpha(player1.profileColor, 0.25)}`,
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
              e.currentTarget.style.boxShadow = `0 0 20px ${withAlpha(player1.profileColor, 0.25)}`;
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
              e.currentTarget.style.boxShadow = `0 0 20px ${withAlpha(player1.profileColor, 0.25)}`;
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
            boxShadow: `0 0 30px ${withAlpha(player1.profileColor, 0.25)}`,
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
              background: withAlpha(player1.profileColor, 0.13),
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
            box-shadow: 0 0 0 0 ${withAlpha(player1.profileColor, 0.25)};
          }
          50% {
            box-shadow: 0 0 0 8px ${withAlpha(player1.profileColor, 0)};
          }
        }
      `}</style>
    </div>
  );
}

export default InhousePlayerSelectScreen;
