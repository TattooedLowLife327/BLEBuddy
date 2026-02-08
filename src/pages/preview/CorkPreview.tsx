import { useState, useEffect } from 'react';
import { ChevronLeft, RefreshCw, DoorOpen } from 'lucide-react';
import { UserMenu, type CustomMenuItem } from '../../components/UserMenu';

const corkKeyframes = `
@keyframes camSlideFromLeft {
  0% { transform: translateY(-50%) translateX(-100%); }
  100% { transform: translateY(-50%) translateX(0); }
}
@keyframes camSlideFromRight {
  0% { transform: translateY(-50%) translateX(100%); }
  100% { transform: translateY(-50%) translateX(0); }
}
@keyframes barSlideUp {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0); }
}
@keyframes colorSwipeUp {
  0% { clip-path: inset(100% 0 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes colorSwipeDown {
  0% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(100% 0 0 0); }
}
@keyframes borderColorPop {
  0% { border-color: #7E7E7E; transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { border-color: var(--pop-color); transform: scale(1); }
}
@keyframes winnerOmbre {
  0% { clip-path: inset(0 0 100% 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes tiePulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.05); }
}
`;

const INACTIVE = '#7E7E7E';
const FONT_SCORE = "'Helvetica', sans-serif";
const FONT_NAME = "'Helvetica', sans-serif";

const FIGMA = {
  frame: { w: 1180, h: 820 },
  bar: { w: 450, h: 90 },
  avatar: 60,
  avatarLeft: 10,
  nameLeft: 80,
  nameSize: 32,
  scoreLeft: 320,
  scoreSize: 72,
};

const MOCK_P1 = {
  id: 'player1',
  name: 'TattooedLowLife',
  profilePic: '/assets/lllogo.png',
  accentColor: '#6600FF',
};

const MOCK_P2 = {
  id: 'player2',
  name: 'ChanTheMan',
  profilePic: undefined,
  accentColor: '#FB00FF',
};

type CorkPreviewProps = {
  onLeaveMatch?: () => void;
};

interface PlayerCorkState {
  status: 'waiting' | 'thrown';
  score: number | null;
  display: string;
}

function CorkSimulator({
  onP1Throw,
  onP2Throw,
  onReset,
  p1State,
  p2State,
  winner,
  canThrow,
}: {
  onP1Throw: (score: number, display: string) => void;
  onP2Throw: (score: number, display: string) => void;
  onReset: () => void;
  p1State: PlayerCorkState;
  p2State: PlayerCorkState;
  winner: string | null;
  canThrow: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const throwOptions = [
    { label: '1', score: 1, display: '1' },
    { label: '5', score: 5, display: '5' },
    { label: '12', score: 12, display: '12' },
    { label: '20', score: 20, display: '20' },
    { label: 'BULL', score: 25, display: '25' },
    { label: 'D-BULL', score: 50, display: '50' },
  ];

  const p1CanThrow = canThrow && p1State.status !== 'thrown' && !winner;
  const p2CanThrow = canThrow && p2State.status !== 'thrown' && !winner;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      right: expanded ? 0 : '-320px',
      transform: 'translateY(-50%)',
      width: '300px',
      background: 'rgba(0, 0, 0, 0.95)',
      backdropFilter: 'blur(12px)',
      borderTopLeftRadius: '16px',
      borderBottomLeftRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRight: 'none',
      padding: '16px',
      zIndex: 500,
      transition: 'right 0.3s ease-out',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          position: 'absolute',
          top: '50%',
          left: '-28px',
          transform: 'translateY(-50%) rotate(-90deg)',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderBottom: 'none',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          padding: '4px 12px',
          color: '#fff',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: FONT_NAME,
          whiteSpace: 'nowrap',
        }}
      >
        {expanded ? 'Hide' : 'Sim'}
      </button>

      <h3 style={{ color: '#fff', fontFamily: FONT_NAME, fontSize: '16px', marginBottom: '12px', textAlign: 'center' }}>
        Cork Simulator
      </h3>

      {!canThrow && (
        <p style={{ color: '#888', fontFamily: FONT_NAME, fontSize: '12px', textAlign: 'center', marginBottom: '12px' }}>
          Waiting for intro...
        </p>
      )}

      <div style={{ marginBottom: '12px' }}>
        <p style={{ color: MOCK_P1.accentColor, fontFamily: FONT_NAME, fontSize: '12px', marginBottom: '6px' }}>
          P1: {p1State.status === 'thrown' ? p1State.display : '-'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {throwOptions.map(opt => (
            <button
              key={`p1-${opt.label}`}
              onClick={() => onP1Throw(opt.score, opt.display)}
              disabled={!p1CanThrow}
              style={{
                padding: '4px 8px',
                background: !p1CanThrow ? '#333' : MOCK_P1.accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: !p1CanThrow ? 'not-allowed' : 'pointer',
                opacity: !p1CanThrow ? 0.5 : 1,
                fontFamily: FONT_NAME,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ color: MOCK_P2.accentColor, fontFamily: FONT_NAME, fontSize: '12px', marginBottom: '6px' }}>
          P2: {p2State.status === 'thrown' ? p2State.display : '-'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {throwOptions.map(opt => (
            <button
              key={`p2-${opt.label}`}
              onClick={() => onP2Throw(opt.score, opt.display)}
              disabled={!p2CanThrow}
              style={{
                padding: '4px 8px',
                background: !p2CanThrow ? '#333' : MOCK_P2.accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: !p2CanThrow ? 'not-allowed' : 'pointer',
                opacity: !p2CanThrow ? 0.5 : 1,
                fontFamily: FONT_NAME,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {winner && (
        <p style={{ color: '#22c55e', fontFamily: FONT_NAME, fontSize: '14px', textAlign: 'center', marginBottom: '12px' }}>
          Winner: {winner === MOCK_P1.id ? MOCK_P1.name : MOCK_P2.name}
        </p>
      )}

      <button
        onClick={onReset}
        style={{
          width: '100%',
          padding: '10px',
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer',
          fontFamily: FONT_NAME,
        }}
      >
        Reset
      </button>
    </div>
  );
}

export function CorkPreview({ onLeaveMatch }: CorkPreviewProps) {
  const [animKey, setAnimKey] = useState(0);

  // Request fullscreen on mobile/tablet
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } catch (err) {
        // Fullscreen not supported or denied - that's ok
        console.log('Fullscreen not available');
      }
    };
    requestFullscreen();

    return () => {
      // Exit fullscreen when leaving
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Phase 0: Just background + header (title visible)
  // Phase 1: Cams slide in from sides, bars slide up from bottom (all grey)
  // Phase 2: Color swipe up on bars + pfp borders, text turns white
  const [phase, setPhase] = useState(0);

  const [p1State, setP1State] = useState<PlayerCorkState>({ status: 'waiting', score: null, display: '' });
  const [p2State, setP2State] = useState<PlayerCorkState>({ status: 'waiting', score: null, display: '' });
  
  // Track when cam borders should pop with color
  const [p1CamPopped, setP1CamPopped] = useState(false);
  const [p2CamPopped, setP2CamPopped] = useState(false);
  
  const [winner, setWinner] = useState<string | null>(null);
  const [tieAlert, setTieAlert] = useState(false);
  const [corkRound, setCorkRound] = useState(1);

  // For player bar animations - matches CROnlineGameScreen pattern
  const [turnKey, setTurnKey] = useState(0);

  const scale = `calc(100vw / ${FIGMA.frame.w})`;
  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';

  // Intro sequence
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setPhase(1), 200));
    timers.push(setTimeout(() => setPhase(2), 1000));
    return () => timers.forEach(clearTimeout);
  }, [animKey]);

  // Check winner
  useEffect(() => {
    if (p1State.status !== 'thrown' || p2State.status !== 'thrown') return;
    if (p1State.score === null || p2State.score === null) return;
    if (winner) return;

    const timer = setTimeout(() => {
      if (p1State.score! > p2State.score!) {
        setWinner(MOCK_P1.id);
      } else if (p2State.score! > p1State.score!) {
        setWinner(MOCK_P2.id);
      } else {
        setTieAlert(true);
        setTimeout(() => {
          setTieAlert(false);
          setP1State({ status: 'waiting', score: null, display: '' });
          setP2State({ status: 'waiting', score: null, display: '' });
          setP1CamPopped(false);
          setP2CamPopped(false);
          setCorkRound(r => r + 1);
          setTurnKey(k => k + 1);
        }, 2000);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [p1State, p2State, winner]);

  const handleP1Throw = (score: number, display: string) => {
    if (phase < 2) return;
    setP1State({ status: 'thrown', score, display });
    setP1CamPopped(true);
  };

  const handleP2Throw = (score: number, display: string) => {
    if (phase < 2) return;
    setP2State({ status: 'thrown', score, display });
    setP2CamPopped(true);
  };

  const handleReset = () => {
    setPhase(0);
    setP1State({ status: 'waiting', score: null, display: '' });
    setP2State({ status: 'waiting', score: null, display: '' });
    setP1CamPopped(false);
    setP2CamPopped(false);
    setWinner(null);
    setTieAlert(false);
    setCorkRound(1);
    setTurnKey(0);
    setAnimKey(k => k + 1);
  };

  const colorsRevealed = phase >= 2;
  const p1IsWinner = winner === MOCK_P1.id;
  const p2IsWinner = winner === MOCK_P2.id;
  const p1IsLoser = winner !== null && !p1IsWinner;
  const p2IsLoser = winner !== null && !p2IsWinner;

  // For the player bars: p1Active/p2Active means colors should show
  const p1Active = colorsRevealed && !p1IsLoser;
  const p2Active = colorsRevealed && !p2IsLoser;

  const customMenuItems: CustomMenuItem[] = [
    { label: 'Refresh Video', icon: RefreshCw, onClick: () => {} },
    { label: 'Leave Match', icon: DoorOpen, onClick: () => { onLeaveMatch?.(); }, className: 'focus:bg-red-500/20 focus:text-white text-red-400 cursor-pointer' },
  ];

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <style>{corkKeyframes}</style>

      {/* Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url('/assets/gamescreenbackground.png')`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', height: '56px' }}>
        <button style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={24} />
        </button>

        <UserMenu
          profilepic="/assets/lllogo.png"
          granboard_name="Preview"
          profilecolor={MOCK_P1.accentColor}
          onLogout={() => {}}
          customItems={customMenuItems}
          size="sm"
        />
      </div>

      {/* Title - below header */}
      <h1 style={{
        position: 'absolute',
        top: `calc(80 * ${scale})`,
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#fff',
        fontFamily: FONT_NAME,
        fontSize: `calc(48 * ${scale})`,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        zIndex: 20,
      }}>
        THROW CORK
      </h1>

      {/* Tie overlay */}
      {tieAlert && (
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          zIndex: 50,
          background: '#ca8a04',
          color: '#000',
          padding: '16px 32px',
          borderRadius: '12px',
          fontSize: '24px',
          fontWeight: 700,
          fontFamily: FONT_NAME,
          animation: 'tiePulse 0.5s ease-in-out infinite',
        }}>
          TIE! Both rethrow!
        </div>
      )}

      {/* CAM 1 - flush left, fixed 16:9 aspect ratio, max height constrained */}
      <div
        key={`cam1-${animKey}`}
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: `min(calc(${FIGMA.bar.w + 50} * ${scale}), 45vh * 16 / 9)`,
          height: `min(calc(${FIGMA.bar.w + 50} * ${scale} * 9 / 16), 45vh)`,
          zIndex: 10,
          animation: phase >= 1 ? 'camSlideFromLeft 0.6s ease-out forwards' : 'none',
        }}
      >
        {p1IsWinner && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 20,
            borderTopRightRadius: `calc(10 * ${scale})`,
            borderBottomRightRadius: `calc(10 * ${scale})`,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, ${MOCK_P1.accentColor}BF 0%, ${MOCK_P1.accentColor}40 15%, transparent 25%)`,
            borderTop: `2px solid ${MOCK_P1.accentColor}`,
            borderRight: `2px solid ${MOCK_P1.accentColor}`,
            borderBottom: `2px solid ${MOCK_P1.accentColor}`,
            borderLeft: 'none',
            animation: 'winnerOmbre 0.5s ease-out forwards',
          }} />
        )}
        {p1IsWinner && (
          <div style={{ position: 'absolute', top: `calc(12 * ${scale})`, left: `calc(12 * ${scale})`, zIndex: 30 }}>
            <span style={{ color: '#fff', fontFamily: FONT_NAME, fontSize: `calc(28 * ${scale})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              WINNER
            </span>
          </div>
        )}
        <div style={{
          width: 'calc(100% + 3px)',
          height: 'calc(100% + 6px)',
          marginLeft: '-3px',
          marginTop: '-3px',
          borderTopRightRadius: `calc(10 * ${scale})`,
          borderBottomRightRadius: `calc(10 * ${scale})`,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${p1IsLoser ? INACTIVE : (p1CamPopped ? MOCK_P1.accentColor : INACTIVE)}`,
          borderLeft: 'none',
          opacity: p1IsLoser ? 0.4 : 1,
          transition: p1IsLoser ? 'opacity 0.15s ease, border-color 0.15s ease' : 'border-color 0.3s ease',
        }}
      />
      </div>

      {/* CAM 2 - flush right, fixed 16:9 aspect ratio, max height constrained */}
      <div
        key={`cam2-${animKey}`}
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: `min(calc(${FIGMA.bar.w + 50} * ${scale}), 45vh * 16 / 9)`,
          height: `min(calc(${FIGMA.bar.w + 50} * ${scale} * 9 / 16), 45vh)`,
          zIndex: 10,
          animation: phase >= 1 ? 'camSlideFromRight 0.6s ease-out forwards' : 'none',
        }}
      >
        {p2IsWinner && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 20,
            borderTopLeftRadius: `calc(10 * ${scale})`,
            borderBottomLeftRadius: `calc(10 * ${scale})`,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, ${MOCK_P2.accentColor}BF 0%, ${MOCK_P2.accentColor}40 15%, transparent 25%)`,
            borderTop: `2px solid ${MOCK_P2.accentColor}`,
            borderLeft: `2px solid ${MOCK_P2.accentColor}`,
            borderBottom: `2px solid ${MOCK_P2.accentColor}`,
            borderRight: 'none',
            animation: 'winnerOmbre 0.5s ease-out forwards',
          }} />
        )}
        {p2IsWinner && (
          <div style={{ position: 'absolute', top: `calc(12 * ${scale})`, right: `calc(12 * ${scale})`, zIndex: 30 }}>
            <span style={{ color: '#fff', fontFamily: FONT_NAME, fontSize: `calc(28 * ${scale})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              WINNER
            </span>
          </div>
        )}
        <div style={{
          width: 'calc(100% + 3px)',
          height: 'calc(100% + 6px)',
          marginRight: '-3px',
          marginTop: '-3px',
          borderTopLeftRadius: `calc(10 * ${scale})`,
          borderBottomLeftRadius: `calc(10 * ${scale})`,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${p2IsLoser ? INACTIVE : (p2CamPopped ? MOCK_P2.accentColor : INACTIVE)}`,
          borderRight: 'none',
          opacity: p2IsLoser ? 0.4 : 1,
          transition: p2IsLoser ? 'opacity 0.15s ease, border-color 0.15s ease' : 'border-color 0.3s ease',
        }}
      />
      </div>

      {/* ===== PLAYER BARS ===== */}
      
      {/* Player 1 Bar - Left */}
      <div
        key={`bar1-${animKey}`}
        style={{
          position: 'absolute',
          width: `calc(${FIGMA.bar.w + 50} * ${scale} + 3px)`,
          height: `calc(${FIGMA.bar.h} * ${scale})`,
          left: '-3px',
          bottom: '0px',
          borderTopRightRadius: `calc(16 * ${scale})`,
          overflow: 'hidden',
          borderTop: `2px solid ${p1Active ? MOCK_P1.accentColor : INACTIVE}`,
          borderRight: `2px solid ${p1Active ? MOCK_P1.accentColor : INACTIVE}`,
          animation: phase >= 1 ? 'barSlideUp 0.6s ease-out forwards' : 'none',
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(100%)',
          transition: 'border-color 0.3s ease',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {colorsRevealed && p1Active && (
          <div key={`p1-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${MOCK_P1.accentColor}40 0%, ${MOCK_P1.accentColor}20 50%, transparent 100%)`,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          background: '#000', border: `2px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {colorsRevealed && p1Active && (
          <div key={`p1-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            background: '#000', border: `2px solid ${MOCK_P1.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        <div style={{
          position: 'absolute', left: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p1Active ? '#FFFFFF' : INACTIVE,
          }}>
            {MOCK_P1.name}
          </span>
        </div>
        <span style={{
          position: 'absolute', right: `calc(20 * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1, 
          color: p1State.status === 'thrown' && p1Active ? MOCK_P1.accentColor : (p1Active ? '#FFFFFF' : INACTIVE),
          textShadow: p1Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {p1State.display}
        </span>
      </div>

      {/* Player 2 Bar - Right */}
      <div
        key={`bar2-${animKey}`}
        style={{
          position: 'absolute',
          width: `calc(${FIGMA.bar.w + 50} * ${scale} + 3px)`,
          height: `calc(${FIGMA.bar.h} * ${scale})`,
          right: '-3px',
          bottom: '0px',
          borderTopLeftRadius: `calc(16 * ${scale})`,
          overflow: 'hidden',
          borderTop: `2px solid ${p2Active ? MOCK_P2.accentColor : INACTIVE}`,
          borderLeft: `2px solid ${p2Active ? MOCK_P2.accentColor : INACTIVE}`,
          animation: phase >= 1 ? 'barSlideUp 0.6s ease-out forwards' : 'none',
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(100%)',
          transition: 'border-color 0.3s ease',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {colorsRevealed && p2Active && (
          <div key={`p2-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${MOCK_P2.accentColor}40 0%, ${MOCK_P2.accentColor}20 50%, transparent 100%)`,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        <span style={{
          position: 'absolute', left: `calc(10 * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1, 
          color: p2State.status === 'thrown' && p2Active ? MOCK_P2.accentColor : (p2Active ? '#FFFFFF' : INACTIVE),
          textShadow: p2Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {p2State.display}
        </span>
        <div style={{
          position: 'absolute', right: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p2Active ? '#FFFFFF' : INACTIVE,
          }}>
            {MOCK_P2.name}
          </span>
        </div>
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          background: '#000', border: `2px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {colorsRevealed && p2Active && (
          <div key={`p2-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            background: '#000', border: `2px solid ${MOCK_P2.accentColor}`, borderRadius: '50%', zIndex: 2,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
      </div>

      <CorkSimulator
        onP1Throw={handleP1Throw}
        onP2Throw={handleP2Throw}
        onReset={handleReset}
        p1State={p1State}
        p2State={p2State}
        winner={winner}
        canThrow={colorsRevealed}
      />
    </div>
  );
}

export default CorkPreview;
