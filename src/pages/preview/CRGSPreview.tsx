import { useState, useCallback, useEffect, useRef } from 'react';

type Target = '20' | '19' | '18' | '17' | '16' | '15' | 'B';
type PlayerId = 'p1' | 'p2';

const TARGETS: Target[] = ['20', '19', '18', '17', '16', '15', 'B'];
const MARK_ICONS: Record<1 | 2 | 3, string> = {
  1: '/assets/CR1Mark.svg',
  2: '/assets/CR2Mark.svg',
  3: '/assets/CR3Mark.svg',
};

const AUTO_THROW_POOL = [
  { segment: 'T20', score: 60, multiplier: 3 },
  { segment: 'T19', score: 57, multiplier: 3 },
  { segment: 'T18', score: 54, multiplier: 3 },
  { segment: 'T17', score: 51, multiplier: 3 },
  { segment: 'T16', score: 48, multiplier: 3 },
  { segment: 'T15', score: 45, multiplier: 3 },
  { segment: 'D20', score: 40, multiplier: 2 },
  { segment: 'S20', score: 20, multiplier: 1 },
  { segment: 'D25', score: 50, multiplier: 2 },
  { segment: 'S25', score: 25, multiplier: 1 },
] as const;

// Dart Simulator Panel for demo/preview mode
function DartSimulator({ onThrow, disabled }: { onThrow: (segment: string, score: number, multiplier: number) => void; disabled: boolean }) {
  const [multiplierMode, setMultiplierMode] = useState<'single' | 'double' | 'triple'>('single');
  const [expanded, setExpanded] = useState(true);

  const handleNumberClick = (num: number) => {
    if (disabled) return;
    const mult = multiplierMode === 'triple' ? 3 : multiplierMode === 'double' ? 2 : 1;
    const prefix = multiplierMode === 'triple' ? 'T' : multiplierMode === 'double' ? 'D' : 'S';
    onThrow(`${prefix}${num}`, num * mult, mult);
  };

  const handleBullClick = (isDouble: boolean) => {
    if (disabled) return;
    if (isDouble) {
      onThrow('D25', 50, 2);
    } else {
      onThrow('S25', 25, 1);
    }
  };

  const handleMissClick = () => {
    if (disabled) return;
    onThrow('MISS', 0, 0);
  };

  // Cricket numbers only
  const cricketNumbers = [20, 19, 18, 17, 16, 15];

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      right: expanded ? 0 : '-280px',
      transform: 'translateY(-50%)',
      width: '260px',
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(12px)',
      borderTopLeftRadius: '16px',
      borderBottomLeftRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRight: 'none',
      padding: '12px 16px 16px',
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
          fontFamily: "'Helvetica Condensed', sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        {expanded ? 'Hide' : 'Sim'}
      </button>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', justifyContent: 'center' }}>
        {(['single', 'double', 'triple'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMultiplierMode(mode)}
            disabled={disabled}
            style={{
              padding: '5px 10px',
              background: multiplierMode === mode ? (mode === 'triple' ? '#FF4444' : mode === 'double' ? '#44FF44' : '#6600FF') : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'Helvetica Condensed', sans-serif",
              fontSize: '12px',
              fontWeight: 600,
              opacity: disabled ? 0.5 : 1,
              textTransform: 'uppercase',
            }}
          >
            {mode === 'single' ? 'S' : mode === 'double' ? 'D' : 'T'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '10px' }}>
        {cricketNumbers.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)}
            disabled={disabled}
            style={{
              height: '32px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'Helvetica Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
        <button
          onClick={() => handleBullClick(false)}
          disabled={disabled}
          style={{
            padding: '6px',
            background: '#228B22',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '11px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          BULL
        </button>
        <button
          onClick={() => handleBullClick(true)}
          disabled={disabled}
          style={{
            padding: '6px',
            background: '#FF4444',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '11px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          D-BULL
        </button>
      </div>
      <button
        onClick={handleMissClick}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '6px',
          background: 'rgba(100, 100, 100, 0.5)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: "'Helvetica Condensed', sans-serif",
          fontSize: '11px',
          fontWeight: 600,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        MISS
      </button>
    </div>
  );
}

interface DartThrow {
  segment: string;
  score: number;
  multiplier: number;
}

type AchievementType =
  | 'win'
  | 'hatTrick'
  | 'threeInBlack'
  | 'ton80'
  | 'threeInBed'
  | 'whiteHorse'
  | null;

const P1_ACTIVE = '#6600FF';
const P2_ACTIVE = '#FB00FF';
const INACTIVE = '#7E7E7E';

const FONT_SCORE = "'Helvetica Compressed', sans-serif";
const FONT_NAME = "'Helvetica Condensed', sans-serif";

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

const PLAYERS = {
  p1: { id: 'p1', name: 'PLAYER1', profilecolor: '#6600FF' },
  p2: { id: 'p2', name: 'PLAYER2', profilecolor: '#FB00FF' },
};

const ROUND_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];

const ACHIEVEMENT_LABELS: Record<Exclude<AchievementType, null>, string> = {
  win: 'GAME!',
  hatTrick: 'HAT TRICK!',
  threeInBlack: '3 IN THE BLACK!',
  ton80: 'TON 80!',
  threeInBed: '3 IN A BED!',
  whiteHorse: 'WHITE HORSE!',
};

const goodLuckKeyframes = `
@keyframes goodLuckSlide {
  0% { left: 100%; transform: translate(0, -50%); }
  25% { left: 50%; transform: translate(-50%, -50%); }
  75% { left: 50%; transform: translate(-50%, -50%); }
  100% { left: -100%; transform: translate(0, -50%); }
}
@keyframes goodLuckBgSlide {
  0% { left: 100%; width: 40%; transform: translateY(-50%); }
  25% { left: 0; width: 100%; transform: translateY(-50%); }
  75% { left: 0; width: 100%; transform: translateY(-50%); }
  100% { left: -100%; width: 40%; transform: translateY(-50%); }
}
@keyframes colorSwipeUp {
  0% { clip-path: inset(100% 0 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes colorSwipeDown {
  0% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(100% 0 0 0); }
}
@keyframes borderDrainDown {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(calc(118 * 100vw / 1180)); opacity: 0; }
}
@keyframes slideInFromLeft {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}
@keyframes slideOutToLeft {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
@keyframes achievementPulse {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  40% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}
@keyframes achievementGlow {
  0%, 100% { filter: drop-shadow(0 0 20px currentColor) drop-shadow(0 0 40px currentColor); }
  50% { filter: drop-shadow(0 0 40px currentColor) drop-shadow(0 0 80px currentColor); }
}
@keyframes winnerFadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes winnerNameSlide {
  0% { transform: translateY(50px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes markPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes circleAround {
  0% { clip-path: polygon(50% 50%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%); }
  12.5% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%); }
  25% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 100% 50%); }
  37.5% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%); }
  50% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 50% 100%, 50% 100%, 50% 100%); }
  62.5% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 100%, 0% 100%); }
  75% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 50%); }
  87.5% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%); }
  100% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%); }
}
@keyframes circleDraw {
  0% { 
    clip-path: polygon(50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%);
  }
  12.5% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 50% 0%);
  }
  25% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 50% 0%);
  }
  37.5% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 50% 0%);
  }
  50% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 50% 100%, 50% 100%, 50% 0%);
  }
  62.5% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 100%, 50% 0%);
  }
  75% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 50% 0%);
  }
  87.5% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%);
  }
  100% { 
    clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%);
  }
}
@keyframes rowFadeOut {
  0% { opacity: 1; filter: none; }
  100% { opacity: 0.35; filter: grayscale(100%); }
}
`;

interface CRGSPreviewProps {
  onLeaveMatch?: () => void;
}

export function CRGSPreview({ onLeaveMatch }: CRGSPreviewProps) {
  // Cricket state
  const [marks, setMarks] = useState<Record<PlayerId, Record<Target, number>>>({
    p1: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 },
    p2: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 },
  });
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);

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
        console.log('Fullscreen not available');
      }
    };
    requestFullscreen();

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Game flow state (copied from 01)
  const [currentThrower, setCurrentThrower] = useState<'p1' | 'p2'>('p1');
  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);
  const [showPlayerChange, setShowPlayerChange] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [showGoodLuck, setShowGoodLuck] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundAnimState, setRoundAnimState] = useState<'in' | 'visible' | 'out'>('in');
  const [roundKey, setRoundKey] = useState(0);
  const [p1ThrewThisRound, setP1ThrewThisRound] = useState(false);
  const [p2ThrewThisRound, setP2ThrewThisRound] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<AchievementType>(null);
  const [gameWinner, setGameWinner] = useState<'p1' | 'p2' | null>(null);
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);
  const autoThrowingRef = useRef(false);

  // MPR tracking - use darts thrown for immediate updates
  const [p1DartsThrown, setP1DartsThrown] = useState(0);
  const [p2DartsThrown, setP2DartsThrown] = useState(0);
  const [p1TotalMarks, setP1TotalMarks] = useState(0);
  const [p2TotalMarks, setP2TotalMarks] = useState(0);
  const [lastScoreChange, setLastScoreChange] = useState<{ player: 'p1' | 'p2'; amount: number } | null>(null);

  // Use ref to track marks in real-time (avoids React state batching issues)
  const marksRef = useRef(marks);
  marksRef.current = marks;

  // Check if a target is dead (both players closed it)
  const isTargetDead = (target: Target): boolean => {
    return marks.p1[target] >= 3 && marks.p2[target] >= 3;
  };

  // MPR = marks per round, where a round = 3 darts
  const p1MPR = p1DartsThrown >= 3 ? (p1TotalMarks / (p1DartsThrown / 3)).toFixed(2) : '0.00';
  const p2MPR = p2DartsThrown >= 3 ? (p2TotalMarks / (p2DartsThrown / 3)).toFixed(2) : '0.00';

  // Turn tracking for animations
  const [prevThrower, setPrevThrower] = useState<'p1' | 'p2' | null>(null);
  const [turnKey, setTurnKey] = useState(0);
  const [hasHadTurnSwitch, setHasHadTurnSwitch] = useState(false);

  const p1Active = currentThrower === 'p1';
  const p2Active = currentThrower === 'p2';
  const p1Exiting = hasHadTurnSwitch && prevThrower === 'p1' && !p1Active;
  const p2Exiting = hasHadTurnSwitch && prevThrower === 'p2' && !p2Active;

  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';
  const scale = `calc(100vw / ${FIGMA.frame.w})`;

  // Intro animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGoodLuck(false);
      setIntroComplete(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Track turn changes
  useEffect(() => {
    if (introComplete) {
      if (turnKey > 0) {
        setPrevThrower(currentThrower === 'p1' ? 'p2' : 'p1');
        setHasHadTurnSwitch(true);
      }
      setTurnKey(prev => prev + 1);
    }
  }, [currentThrower, introComplete]);

  // Map segment to cricket target
  const mapSegmentToTarget = (segment: string, multiplier: number): { target: Target | null; hitMarks: number } => {
    if (segment === 'MISS') return { target: null, hitMarks: 0 };
    if (segment === 'S25') return { target: 'B', hitMarks: 1 };
    if (segment === 'D25') return { target: 'B', hitMarks: 2 };
    const num = parseInt(segment.slice(1), 10);
    if ([20, 19, 18, 17, 16, 15].includes(num)) {
      return { target: num.toString() as Target, hitMarks: multiplier };
    }
    return { target: null, hitMarks: 0 };
  };

  // Detect cricket achievements
  const detectAchievement = (darts: DartThrow[]): AchievementType => {
    if (darts.length !== 3) return null;
    const segments = darts.map(d => d.segment);

    if (segments.every(s => s === 'T20')) return 'ton80';
    if (segments.every(s => s === 'D25')) return 'threeInBlack';
    if (segments.every(s => s === 'S25' || s === 'D25')) return 'hatTrick';

    const triples = segments.filter(s => s.startsWith('T'));
    if (triples.length === 3) {
      const unique = new Set(triples);
      if (unique.size === 1) return 'threeInBed';
      const cricketTriples = ['T20', 'T19', 'T18', 'T17', 'T16', 'T15'];
      if (triples.every(t => cricketTriples.includes(t)) && unique.size === 3) return 'whiteHorse';
    }

    return null;
  };

  // Throw dart handler
  const throwDart = useCallback((segment: string, _score: number, multiplier: number) => {
    if (currentDarts.length >= 3 || showPlayerChange || !introComplete || showWinnerScreen) return;

    const { target, hitMarks } = mapSegmentToTarget(segment, multiplier);
    const newDart: DartThrow = { segment, score: 0, multiplier };
    const newDarts = [...currentDarts, newDart];
    setCurrentDarts(newDarts);

    // Count marks for MPR, but don't credit marks beyond closing a dead target
    if (target) {
      const opp: PlayerId = currentThrower === 'p1' ? 'p2' : 'p1';
      const currentMarks = marksRef.current[currentThrower][target];
      const oppMarks = marksRef.current[opp][target];
      const cappedMarks = oppMarks >= 3 ? Math.max(0, 3 - currentMarks) : hitMarks;
      if (cappedMarks > 0) {
        if (currentThrower === 'p1') {
          setP1TotalMarks(prev => prev + cappedMarks);
        } else {
          setP2TotalMarks(prev => prev + cappedMarks);
        }
      }
    }

    // Always increment darts thrown for MPR calculation
    if (currentThrower === 'p1') {
      setP1DartsThrown(prev => prev + 1);
    } else {
      setP2DartsThrown(prev => prev + 1);
    }

    // Apply marks and calculate scoring if valid target
    if (target) {
      const opp: PlayerId = currentThrower === 'p1' ? 'p2' : 'p1';
      // Use ref for current marks to avoid React batching issues between throws
      const currentMarks = marksRef.current[currentThrower][target];
      const oppMarks = marksRef.current[opp][target];

      // Calculate new marks and overflow
      const newMarks = Math.min(3, currentMarks + hitMarks);
      const overflow = Math.max(0, (currentMarks + hitMarks) - 3);

      console.log(`[Cricket] ${target}: currentMarks=${currentMarks}, hitMarks=${hitMarks}, newMarks=${newMarks}, overflow=${overflow}, oppMarks=${oppMarks}`);

      // Update ref immediately so next throw in same turn sees updated value
      marksRef.current = {
        ...marksRef.current,
        [currentThrower]: {
          ...marksRef.current[currentThrower],
          [target]: newMarks,
        },
      };

      // Update React state (for rendering)
      setMarks(marksRef.current);

      // Calculate and apply scoring
      let pointsScored = 0;
      if (newMarks === 3 && oppMarks < 3 && overflow > 0) {
        // Just closed with overflow - score the overflow
        const value = target === 'B' ? 25 : parseInt(target, 10);
        pointsScored = overflow * value;
        console.log(`[Cricket] Closing with overflow: ${overflow} * ${value} = ${pointsScored}`);
      } else if (currentMarks >= 3 && oppMarks < 3) {
        // Already closed, score all marks
        const value = target === 'B' ? 25 : parseInt(target, 10);
        pointsScored = hitMarks * value;
        console.log(`[Cricket] Already closed, scoring: ${hitMarks} * ${value} = ${pointsScored}`);
      }

      if (pointsScored > 0) {
        console.log(`[Cricket] Adding ${pointsScored} points to ${currentThrower}`);
        if (currentThrower === 'p1') {
          setP1Score(s => s + pointsScored);
        } else {
          setP2Score(s => s + pointsScored);
        }
        setLastScoreChange({ player: currentThrower, amount: pointsScored });
        setTimeout(() => setLastScoreChange(null), 1500);
      }

      // Check win: all closed + higher or equal score
      const allClosed = TARGETS.every(t => marksRef.current[currentThrower][t] >= 3);
      if (allClosed) {
        const myScore = (currentThrower === 'p1' ? p1Score : p2Score) + pointsScored;
        const theirScore = currentThrower === 'p1' ? p2Score : p1Score;
        if (myScore >= theirScore) {
          setGameWinner(currentThrower);
          setTimeout(() => setShowWinnerScreen(true), 500);
        }
      }
    }

    // Check achievements & end turn on 3rd dart
    if (newDarts.length === 3) {
      const achievement = detectAchievement(newDarts);
      if (achievement) {
        setActiveAnimation(achievement);
        setTimeout(() => setActiveAnimation(null), 2000);
      }
      setShowPlayerChange(true);
    }
  }, [currentDarts, currentThrower, introComplete, showPlayerChange, showWinnerScreen, p1Score, p2Score]);

  useEffect(() => {
    if (
      currentThrower !== 'p2' ||
      showPlayerChange ||
      !introComplete ||
      showWinnerScreen ||
      !!activeAnimation
    ) {
      autoThrowingRef.current = false;
      return;
    }
    if (autoThrowingRef.current) return;
    autoThrowingRef.current = true;

    let canceled = false;
    let dartCount = 0;

    const throwNext = () => {
      if (canceled) return;
      if (
        currentThrower !== 'p2' ||
        showPlayerChange ||
        showWinnerScreen ||
        !!activeAnimation
      ) {
        autoThrowingRef.current = false;
        return;
      }
      if (dartCount >= 3) {
        autoThrowingRef.current = false;
        return;
      }
      const pick = AUTO_THROW_POOL[Math.floor(Math.random() * AUTO_THROW_POOL.length)];
      throwDart(pick.segment, pick.score, pick.multiplier);
      dartCount += 1;
      setTimeout(throwNext, 650);
    };

    const timer = setTimeout(throwNext, 500);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [activeAnimation, currentThrower, introComplete, showPlayerChange, showWinnerScreen, throwDart]);

  // Handle player change
  useEffect(() => {
    if (showPlayerChange) {
      const timer = setTimeout(() => {
        // Track which player threw for round counting
        if (currentThrower === 'p1') {
          setP1ThrewThisRound(true);
        } else {
          setP2ThrewThisRound(true);
        }

        // Check if round complete
        const willCompleteRound = (currentThrower === 'p1' && p2ThrewThisRound) ||
                                   (currentThrower === 'p2' && p1ThrewThisRound);

        if (willCompleteRound) {
          setRoundAnimState('out');
          setTimeout(() => {
            setCurrentRound(prev => prev + 1);
            setRoundKey(prev => prev + 1);
            setP1ThrewThisRound(false);
            setP2ThrewThisRound(false);
            setRoundAnimState('in');
          }, 500);
        }

        setShowPlayerChange(false);
        setCurrentThrower(t => t === 'p1' ? 'p2' : 'p1');
        setCurrentDarts([]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showPlayerChange, currentThrower, p1ThrewThisRound, p2ThrewThisRound]);

  const formatDart = (segment: string) => {
    if (segment === 'MISS') return 'MISS';
    if (segment === 'S25') return 'BULL';
    if (segment === 'D25') return 'DBULL';
    return segment;
  };

  // Render mark icon for a player/target
  const renderMarkIcon = (player: PlayerId, target: Target) => {
    const count = marks[player][target];
    if (count === 0) return null;
    const cappedCount = Math.min(3, count) as 1 | 2 | 3;
    const markHeight = `calc(34 * ${scale})`;
    
    return (
      <div 
        key={`${player}-${target}-${cappedCount}`}
        style={{ 
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: `calc(44 * ${scale})`,
          height: markHeight,
        }}
      >
        {/* First slash / */}
        <img
          src={MARK_ICONS[1]}
          alt="mark"
          style={{ 
            position: 'absolute',
            height: markHeight, 
            width: 'auto',
            animation: cappedCount === 1 ? 'markPop 0.3s ease-out forwards' : 'none',
          }}
        />
        
        {/* Second slash \ */}
        {cappedCount >= 2 && (
          <img
            src={MARK_ICONS[2]}
            alt="mark"
            style={{ 
              position: 'absolute',
              height: markHeight, 
              width: 'auto',
              animation: 'markPop 0.3s ease-out forwards',
            }}
          />
        )}
        
        {/* Circle around the X */}
        {cappedCount === 3 && (
          <div
            style={{
              position: 'absolute',
              width: `calc(44 * ${scale})`,
              height: `calc(44 * ${scale})`,
              borderRadius: '50%',
              border: `calc(6 * ${scale}) solid #FFFFFF`,
              animation: 'circleDraw 0.4s ease-out forwards',
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: '#000000',
      overflow: 'hidden',
    }}>
      <style>{goodLuckKeyframes}</style>

      {/* Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/assets/gamescreenbackground.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Game Type Header - Top Center */}
      <div style={{
        position: 'absolute',
        top: `calc(20 * ${scale})`,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: `calc(8 * ${scale}) calc(24 * ${scale})`,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        borderRadius: `calc(8 * ${scale})`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 50,
      }}>
        <span style={{
          fontFamily: FONT_NAME,
          fontWeight: 700,
          fontSize: `calc(28 * ${scale})`,
          color: '#FFFFFF',
        }}>
          CRICKET
        </span>
      </div>

      {/* CRICKET SCOREBOARD - Center */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: `calc(90 * ${scale})`,
        bottom: `calc(130 * ${scale})`,
        transform: 'translateX(-50%)',
        width: `calc(400 * ${scale})`,
        zIndex: 10,
      }}>
        {/* Background - glassmorphic with grid lines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(12px)',
          borderRadius: `calc(12 * ${scale})`,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
        }}>
          {/* Left column divider */}
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)' }} />
          {/* Center column */}
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)' }} />
          {/* Right column */}
          <div />
        </div>

        {/* Score grid overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `calc(5 * ${scale}) 0`,
          overflow: 'hidden',
        }}>
          {TARGETS.map(target => {
            const dead = isTargetDead(target);
            return (
              <div
                key={target}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  alignItems: 'center',
                  flex: '1 1 0',
                  minHeight: 0,
                  opacity: dead ? 0.35 : 1,
                  filter: dead ? 'grayscale(100%)' : 'none',
                  transition: 'opacity 0.5s ease-out, filter 0.5s ease-out',
                }}
              >
              {/* P1 marks - left column */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {renderMarkIcon('p1', target)}
              </div>

              {/* Number - center column */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: FONT_SCORE,
                fontSize: `calc(38 * ${scale})`,
                fontWeight: 700,
                color: dead ? 'rgba(255, 255, 255, 0.4)' : '#FFFFFF',
                textShadow: dead ? 'none' : '-2px 2px 4px rgba(0, 0, 0, 0.5)',
              }}>
                {target === 'B' ? 'B' : target}
              </div>

              {/* P2 marks - right column */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {renderMarkIcon('p2', target)}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* GOOD LUCK Animation */}
      {showGoodLuck && (
        <>
          <div style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            height: `calc(260 * ${scale})`,
            width: '40%',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 99,
            animation: 'goodLuckBgSlide 4s ease-in-out forwards',
          }} />
          <div style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translate(0, -50%)',
            fontFamily: FONT_SCORE,
            fontWeight: 300,
            fontSize: `calc(200 * ${scale})`,
            lineHeight: 1,
            color: '#FFFFFF',
            textShadow: '-6px 6px 9.7px rgba(0, 0, 0, 0.78)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            animation: 'goodLuckSlide 4s ease-in-out forwards',
          }}>
            GOOD LUCK!
          </div>
        </>
      )}

      {/* Round Indicator */}
      {introComplete && (
        <div
          key={`round-${roundKey}`}
          style={{
            position: 'absolute',
            top: `calc(20 * ${scale})`,
            left: 0,
            display: 'flex',
            alignItems: 'center',
            zIndex: 50,
            animation: roundAnimState === 'out'
              ? 'slideOutToLeft 0.5s ease-in forwards'
              : roundAnimState === 'in'
                ? 'slideInFromLeft 0.5s ease-out forwards'
                : 'none',
          }}
        >
          <div style={{
            padding: `calc(12 * ${scale}) calc(24 * ${scale})`,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: `0 calc(8 * ${scale}) calc(8 * ${scale}) 0`,
          }}>
            <span style={{
              fontFamily: FONT_SCORE,
              fontWeight: 300,
              fontSize: `calc(48 * ${scale})`,
              lineHeight: 1,
              color: '#FFFFFF',
              textShadow: '-3px 3px 5px rgba(0, 0, 0, 0.78)',
              whiteSpace: 'nowrap',
            }}>
              ROUND {ROUND_WORDS[currentRound - 1] || currentRound}
            </span>
          </div>
        </div>
      )}

      {/* Darts display above active player bar */}
      {currentDarts.length > 0 && introComplete && (
        <>
          {currentDarts.map((dart, i) => {
            const thirdCenters = [85.5, 256.5, 427.5];
            const centerPos = thirdCenters[i];
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  bottom: `calc(${FIGMA.bar.h - 4} * ${scale})`,
                  ...(p1Active
                    ? { left: `calc(${centerPos} * ${scale})`, transform: 'translateX(-50%)' }
                    : { right: `calc(${centerPos} * ${scale})`, transform: 'translateX(50%)' }
                  ),
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontFamily: FONT_NAME,
                  fontWeight: 500,
                  fontSize: `calc(28 * ${scale})`,
                  color: '#FFFFFF',
                }}>
                  {formatDart(dart.segment)}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Player 1 Bar - Left */}
      <div style={{
        position: 'absolute',
        width: `calc(${FIGMA.bar.w} * ${scale})`,
        height: `calc(${FIGMA.bar.h} * ${scale})`,
        left: '0px',
        bottom: '0px',
        borderTopRightRadius: `calc(16 * ${scale})`,
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {introComplete && p1Active && (
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '3px',
            width: `${(currentDarts.length / 3) * 100}%`,
            background: P1_ACTIVE, transition: 'width 0.2s ease-out', zIndex: 5,
          }} />
        )}
        {introComplete && p1Exiting && (
          <div key={`p1-exit-${turnKey}`} style={{
            position: 'absolute', top: 0, left: 0, height: '3px', width: '100%',
            background: P1_ACTIVE, zIndex: 5, animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && (p1Active || p1Exiting) && (
          <div key={`p1-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(179.4deg, rgba(102, 0, 255, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)',
            animation: p1Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Avatar grey */}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          background: '#000', border: `3px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {introComplete && (p1Active || p1Exiting) && (
          <div key={`p1-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            background: '#000', border: `3px solid ${P1_ACTIVE}`, borderRadius: '50%', zIndex: 2,
            animation: p1Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Name + MPR */}
        <div style={{
          position: 'absolute', left: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p1Active ? '#FFFFFF' : INACTIVE,
          }}>
            {PLAYERS.p1.name}
          </span>
          {introComplete && (
            <span style={{
              fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(16 * ${scale})`,
              color: p1Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              MPR: {p1MPR}
            </span>
          )}
        </div>
        {/* Cricket score (points) */}
        <span style={{
          position: 'absolute', left: `calc(${FIGMA.scoreLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1, color: p1Active ? '#FFFFFF' : INACTIVE,
          textShadow: p1Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {p1Score}
        </span>
      </div>

      {/* Player 2 Bar - Right */}
      <div style={{
        position: 'absolute',
        width: `calc(${FIGMA.bar.w} * ${scale})`,
        height: `calc(${FIGMA.bar.h} * ${scale})`,
        right: '0px',
        bottom: '0px',
        borderTopLeftRadius: `calc(16 * ${scale})`,
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {introComplete && p2Active && (
          <div style={{
            position: 'absolute', top: 0, right: 0, height: '3px',
            width: `${(currentDarts.length / 3) * 100}%`,
            background: P2_ACTIVE, transition: 'width 0.2s ease-out', zIndex: 5,
          }} />
        )}
        {introComplete && p2Exiting && (
          <div key={`p2-exit-${turnKey}`} style={{
            position: 'absolute', top: 0, right: 0, height: '3px', width: '100%',
            background: P2_ACTIVE, zIndex: 5, animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && (p2Active || p2Exiting) && (
          <div key={`p2-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(179.4deg, rgba(251, 0, 255, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)',
            animation: p2Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
        {/* Score left for P2 */}
        <span style={{
          position: 'absolute', left: `calc(20 * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1, color: p2Active ? '#FFFFFF' : INACTIVE,
          textShadow: p2Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {p2Score}
        </span>
        {/* Name + MPR right-aligned */}
        <div style={{
          position: 'absolute', right: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: p2Active ? '#FFFFFF' : INACTIVE,
          }}>
            {PLAYERS.p2.name}
          </span>
          {introComplete && (
            <span style={{
              fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(16 * ${scale})`,
              color: p2Active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(126, 126, 126, 0.6)',
              marginTop: `calc(-4 * ${scale})`,
            }}>
              MPR: {p2MPR}
            </span>
          )}
        </div>
        {/* Avatar grey */}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          background: '#000', border: `3px solid ${INACTIVE}`, borderRadius: '50%', zIndex: 1,
        }} />
        {introComplete && (p2Active || p2Exiting) && (
          <div key={`p2-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            background: '#000', border: `3px solid ${P2_ACTIVE}`, borderRadius: '50%', zIndex: 2,
            animation: p2Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
      </div>

      {/* Hamburger Menu */}
      <div style={{ position: 'absolute', top: `calc(20 * ${scale})`, right: `calc(20 * ${scale})`, zIndex: 100 }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: `calc(44 * ${scale})`, height: `calc(44 * ${scale})`,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            gap: `calc(6 * ${scale})`, padding: `calc(8 * ${scale})`,
          }}
        >
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFF', borderRadius: '2px' }} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: `calc(50 * ${scale})`, right: 0,
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)',
            borderRadius: `calc(8 * ${scale})`, border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden', minWidth: `calc(160 * ${scale})`,
          }}>
            <button
              onClick={() => { setMenuOpen(false); onLeaveMatch?.(); }}
              style={{
                width: '100%', padding: `calc(14 * ${scale}) calc(20 * ${scale})`,
                background: 'transparent', border: 'none', color: '#FF4444',
                fontFamily: FONT_NAME, fontSize: `calc(18 * ${scale})`, fontWeight: 500,
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              Leave Game
            </button>
          </div>
        )}
      </div>

      {/* Achievement Animation */}
      {activeAnimation && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle, ${PLAYERS[currentThrower].profilecolor}33 0%, transparent 70%)`,
            animation: 'achievementPulse 2s ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(120 * ${scale})`, lineHeight: 1,
            color: PLAYERS[currentThrower].profilecolor,
            textShadow: `0 0 30px ${PLAYERS[currentThrower].profilecolor}, 0 0 60px ${PLAYERS[currentThrower].profilecolor}, -4px 4px 8px rgba(0, 0, 0, 0.8)`,
            whiteSpace: 'nowrap',
            animation: 'achievementPulse 2s ease-out forwards, achievementGlow 0.5s ease-in-out infinite',
          }}>
            {ACHIEVEMENT_LABELS[activeAnimation]}
          </div>
        </div>
      )}

      {/* Winner Screen */}
      {showWinnerScreen && gameWinner && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 300,
          background: 'rgba(0, 0, 0, 0.9)', animation: 'winnerFadeIn 0.5s ease-out forwards',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at center, ${PLAYERS[gameWinner].profilecolor}40 0%, transparent 60%)`,
          }} />
          <div style={{
            fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(60 * ${scale})`, lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.6)', letterSpacing: `calc(20 * ${scale})`,
            marginBottom: `calc(20 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.2s', opacity: 0,
          }}>
            WINNER
          </div>
          <div style={{
            fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(160 * ${scale})`, lineHeight: 1,
            color: PLAYERS[gameWinner].profilecolor,
            textShadow: `0 0 40px ${PLAYERS[gameWinner].profilecolor}, 0 0 80px ${PLAYERS[gameWinner].profilecolor}, -6px 6px 12px rgba(0, 0, 0, 0.8)`,
            animation: 'winnerNameSlide 0.8s ease-out forwards', animationDelay: '0.4s', opacity: 0,
          }}>
            {PLAYERS[gameWinner].name}
          </div>
          <div style={{
            fontFamily: FONT_NAME, fontSize: `calc(28 * ${scale})`, color: 'rgba(255, 255, 255, 0.5)',
            marginTop: `calc(30 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.6s', opacity: 0,
          }}>
            Final: {gameWinner === 'p1' ? p1Score : p2Score} - {gameWinner === 'p1' ? p2Score : p1Score}
          </div>
          <div style={{
            display: 'flex', gap: `calc(20 * ${scale})`, marginTop: `calc(60 * ${scale})`,
            animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.8s', opacity: 0,
          }}>
            <button
              onClick={() => {
                setShowWinnerScreen(false);
                setGameWinner(null);
                const resetMarks = { p1: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 }, p2: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 } };
                setMarks(resetMarks);
                marksRef.current = resetMarks;
                setP1Score(0); setP2Score(0);
                setCurrentRound(1); setCurrentThrower('p1'); setCurrentDarts([]);
                setP1DartsThrown(0); setP2DartsThrown(0); setP1TotalMarks(0); setP2TotalMarks(0);
                setP1ThrewThisRound(false); setP2ThrewThisRound(false);
                setShowGoodLuck(true); setIntroComplete(false);
              }}
              style={{
                padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                color: '#FFF', background: PLAYERS[gameWinner].profilecolor,
                border: 'none', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                boxShadow: `0 0 30px ${PLAYERS[gameWinner].profilecolor}80`,
              }}
            >
              Rematch
            </button>
            <button
              onClick={() => { setShowWinnerScreen(false); setGameWinner(null); onLeaveMatch?.(); }}
              style={{
                padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)', background: 'transparent',
                border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
              }}
            >
              Exit to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Dart Simulator */}
      {currentThrower === 'p1' && (
        <DartSimulator
          onThrow={throwDart}
          disabled={showPlayerChange || !introComplete || showWinnerScreen || !!activeAnimation}
        />
      )}
    </div>
  );
}

export default CRGSPreview;
