import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { isDevMode } from '../utils/devMode';

type Target = '20' | '19' | '18' | '17' | '16' | '15' | 'B';
type PlayerId = 'p1' | 'p2';

const TARGETS: Target[] = ['20', '19', '18', '17', '16', '15', 'B'];
const MARK_ICONS: Record<1 | 2 | 3, string> = {
  1: '/assets/CR1Mark.svg',
  2: '/assets/CR2Mark.svg',
  3: '/assets/CR3Mark.svg',
};

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

interface PlayerData {
  id: string;
  name: string;
  profilePic?: string;
  profileColor: string;
}

interface CRInhouseGameScreenProps {
  onLeaveMatch: () => void;
  backgroundImage?: string;
  startingPlayer?: 'p1' | 'p2';
  onGameComplete?: (winner: 'p1' | 'p2') => void;
  player1?: PlayerData;
  playerMode?: 'solo' | 'guest';
}

// Default players - will be overridden by props if provided
const DEFAULT_PLAYERS = {
  p1: { id: 'p1', name: 'PLAYER1', profilecolor: '#6600FF', profilePic: undefined as string | undefined },
  p2: { id: 'p2', name: 'PLAYER2', profilecolor: '#FB00FF', profilePic: undefined as string | undefined },
};

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

// Award videos for achievements
const AWARD_VIDEOS: Partial<Record<Exclude<AchievementType, null>, string>> = {
  hatTrick: '/awards/blue&orange/hattrick.mp4',
  threeInBlack: '/awards/blue&orange/3intheblack.mp4',
  ton80: '/awards/blue&orange/ton80.mp4',
  threeInBed: '/awards/blue&orange/3inabed.mp4',
  whiteHorse: '/awards/blue&orange/whitehorse.mp4',
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
@keyframes circleDraw {
  0% { clip-path: polygon(50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%); }
  12.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%, 50% 0%); }
  25% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 100% 50%, 50% 0%); }
  37.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 50% 0%); }
  50% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 50% 100%, 50% 100%, 50% 0%); }
  62.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 100%, 50% 0%); }
  75% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 50% 0%); }
  87.5% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%); }
  100% { clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%); }
}
`;

export function CRInhouseGameScreen({
  onLeaveMatch,
  backgroundImage = '/assets/gamescreenbackground.png',
  startingPlayer,
  onGameComplete,
  player1,
  playerMode = 'guest',
}: CRInhouseGameScreenProps) {
  // BLE for throw detection
  const { lastThrow, isConnected: bleConnected, connect: bleConnect, disconnect: bleDisconnect, status: bleStatus } = useBLE();
  const lastProcessedThrowRef = useRef<string | null>(null);
  const playerChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSoloMode = playerMode === 'solo';

  // Build players object from props or defaults
  const PLAYERS = useMemo(() => ({
    p1: player1 ? {
      id: player1.id,
      name: player1.name,
      profilecolor: player1.profileColor,
      profilePic: player1.profilePic,
    } : DEFAULT_PLAYERS.p1,
    p2: isSoloMode ? null : { id: 'guest', name: 'GUEST', profilecolor: '#FB00FF', profilePic: undefined },
  }), [player1, isSoloMode]);

  // Cricket state
  const [marks, setMarks] = useState<Record<PlayerId, Record<Target, number>>>({
    p1: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 },
    p2: { '20': 0, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, B: 0 },
  });
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);

  // Game flow state
  const [currentThrower, setCurrentThrower] = useState<'p1' | 'p2'>(() => startingPlayer || 'p1');
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

  // MPR tracking
  const [p1DartsThrown, setP1DartsThrown] = useState(0);
  const [p2DartsThrown, setP2DartsThrown] = useState(0);
  const [p1TotalMarks, setP1TotalMarks] = useState(0);
  const [p2TotalMarks, setP2TotalMarks] = useState(0);

  // Track when each player reached their current score (for tiebreaker: who got there first)
  const [p1ScoreReachedRound, setP1ScoreReachedRound] = useState(1);
  const [p2ScoreReachedRound, setP2ScoreReachedRound] = useState(1);

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

  // Check if a target is dead (both players closed it)
  const isTargetDead = (target: Target): boolean => {
    return marks.p1[target] >= 3 && marks.p2[target] >= 3;
  };

  // MPR = marks per round, where a round = 3 darts
  const p1MPR = p1DartsThrown >= 3 ? (p1TotalMarks / (p1DartsThrown / 3)).toFixed(2) : '0.00';
  const p2MPR = p2DartsThrown >= 3 ? (p2TotalMarks / (p2DartsThrown / 3)).toFixed(2) : '0.00';

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

  // Apply a throw
  const applyThrow = useCallback((segment: string, multiplier: number) => {
    if (currentDarts.length >= 3 || showPlayerChange || !introComplete || showWinnerScreen) return;

    const { target, hitMarks } = mapSegmentToTarget(segment, multiplier);
    const newDart: DartThrow = { segment, score: 0, multiplier };
    const newDarts = [...currentDarts, newDart];
    setCurrentDarts(newDarts);

    // Count marks for MPR, but don't credit marks beyond closing a dead target
    if (target) {
      const opp: PlayerId = currentThrower === 'p1' ? 'p2' : 'p1';
      const currentMarks = marks[currentThrower][target];
      const oppMarks = marks[opp][target];
      const cappedMarks = oppMarks >= 3 ? Math.max(0, 3 - currentMarks) : hitMarks;
      if (cappedMarks > 0) {
        if (currentThrower === 'p1') {
          setP1TotalMarks(prev => prev + cappedMarks);
        } else {
          setP2TotalMarks(prev => prev + cappedMarks);
        }
      }
    }

    // Increment darts thrown
    if (currentThrower === 'p1') {
      setP1DartsThrown(prev => prev + 1);
    } else {
      setP2DartsThrown(prev => prev + 1);
    }

    // Apply marks if valid target
    if (target) {
      setMarks(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        const opp: PlayerId = currentThrower === 'p1' ? 'p2' : 'p1';
        const currentMarks = next[currentThrower][target];
        const oppMarks = next[opp][target];

        const newMarks = Math.min(3, currentMarks + hitMarks);
        const overflow = Math.max(0, (currentMarks + hitMarks) - 3);
        next[currentThrower][target] = newMarks;

        // Score points if closed and opponent hasn't closed
        if (newMarks === 3 && oppMarks < 3 && overflow > 0) {
          const value = target === 'B' ? 25 : parseInt(target, 10);
          if (currentThrower === 'p1') {
            setP1Score(s => s + overflow * value);
            setP1ScoreReachedRound(currentRound);
          } else {
            setP2Score(s => s + overflow * value);
            setP2ScoreReachedRound(currentRound);
          }
        } else if (currentMarks >= 3 && oppMarks < 3) {
          const value = target === 'B' ? 25 : parseInt(target, 10);
          if (currentThrower === 'p1') {
            setP1Score(s => s + hitMarks * value);
            setP1ScoreReachedRound(currentRound);
          } else {
            setP2Score(s => s + hitMarks * value);
            setP2ScoreReachedRound(currentRound);
          }
        }

        // Check win
        const allClosed = TARGETS.every(t => next[currentThrower][t] >= 3);
        if (allClosed) {
          const myScore = currentThrower === 'p1' ? p1Score : p2Score;
          const theirScore = currentThrower === 'p1' ? p2Score : p1Score;
          if (myScore >= theirScore) {
            setGameWinner(currentThrower);
            setTimeout(() => setShowWinnerScreen(true), 500);
          }
        }

        return next;
      });
    }

    // Check achievements & end turn on 3rd dart
    if (newDarts.length === 3) {
      const achievement = detectAchievement(newDarts);
      if (achievement) {
        setActiveAnimation(achievement);
        // 7 seconds to let award videos play fully (button can skip)
        setTimeout(() => setActiveAnimation(null), 7000);
      }
      // Add delay before player change to let dart effects complete (button press skips this)
      playerChangeTimeoutRef.current = setTimeout(() => {
        playerChangeTimeoutRef.current = null;
        setShowPlayerChange(true);
      }, 7000);
    }
  }, [currentDarts, currentThrower, introComplete, showPlayerChange, showWinnerScreen, p1Score, p2Score, marks, currentRound]);

  const endTurnWithMisses = useCallback(() => {
    if (showPlayerChange || !introComplete || showWinnerScreen) return;
    // Clear any pending player change timeout (button press = instant change)
    if (playerChangeTimeoutRef.current) {
      clearTimeout(playerChangeTimeoutRef.current);
      playerChangeTimeoutRef.current = null;
    }
    // Clear any active animation (button skips it)
    if (activeAnimation) {
      setActiveAnimation(null);
    }
    const remaining = Math.max(0, 3 - currentDarts.length);
    if (remaining === 0) {
      setShowPlayerChange(true);
      return;
    }
    const misses = Array.from({ length: remaining }, () => ({ segment: 'MISS', score: 0, multiplier: 0 }));
    setCurrentDarts([...currentDarts, ...misses]);
    if (currentThrower === 'p1') {
      setP1DartsThrown(prev => prev + remaining);
    } else {
      setP2DartsThrown(prev => prev + remaining);
    }
    setShowPlayerChange(true);
  }, [activeAnimation, currentDarts, currentThrower, introComplete, showPlayerChange, showWinnerScreen]);

  // Handle BLE throws
  useEffect(() => {
    if (!lastThrow) return;

    const throwKey = `${lastThrow.segment}-${lastThrow.timestamp}`;
    if (throwKey === lastProcessedThrowRef.current) return;
    lastProcessedThrowRef.current = throwKey;
    if (lastThrow.segmentType === 'BUTTON' || lastThrow.segment === 'BTN') {
      endTurnWithMisses();
      return;
    }

    // Convert BLE segment types to standard format
    let segment = lastThrow.segment;
    if (lastThrow.segmentType === 'BULL') segment = 'S25';
    else if (lastThrow.segmentType === 'DBL_BULL') segment = 'D25';
    const multiplier = lastThrow.multiplier;

    applyThrow(segment, multiplier);
  }, [lastThrow, applyThrow, endTurnWithMisses]);

  // Handle player change
  useEffect(() => {
    if (showPlayerChange) {
      const timer = setTimeout(() => {
        if (currentThrower === 'p1') {
          setP1ThrewThisRound(true);
        } else {
          setP2ThrewThisRound(true);
        }

        // Solo mode: increment round after each turn, no player switching
        if (isSoloMode) {
          setRoundAnimState('out');
          setTimeout(() => {
            setCurrentRound(prev => prev + 1);
            setRoundKey(prev => prev + 1);
            setRoundAnimState('in');
          }, 500);
          setShowPlayerChange(false);
          setCurrentDarts([]);
          return;
        }

        const willCompleteRound = (currentThrower === 'p1' && p2ThrewThisRound) ||
                                   (currentThrower === 'p2' && p1ThrewThisRound);

        // Round 20 limit: If round 20 completes without a winner, determine by tiebreaker
        if (willCompleteRound && currentRound === 20 && !gameWinner) {
          let winner: 'p1' | 'p2';
          if (p1Score > p2Score) {
            // P1 has more points - P1 wins
            winner = 'p1';
          } else if (p2Score > p1Score) {
            // P2 has more points - P2 wins
            winner = 'p2';
          } else if (p1TotalMarks > p2TotalMarks) {
            // Points tied, P1 has more marks - P1 wins
            winner = 'p1';
          } else if (p2TotalMarks > p1TotalMarks) {
            // Points tied, P2 has more marks - P2 wins
            winner = 'p2';
          } else {
            // Points and marks both tied - whoever reached that point total first wins
            winner = p1ScoreReachedRound <= p2ScoreReachedRound ? 'p1' : 'p2';
          }
          setGameWinner(winner);
          setTimeout(() => setShowWinnerScreen(true), 500);
          return;
        }

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
  }, [showPlayerChange, currentThrower, p1ThrewThisRound, p2ThrewThisRound, isSoloMode, currentRound, gameWinner, p1Score, p2Score, p1TotalMarks, p2TotalMarks, p1ScoreReachedRound, p2ScoreReachedRound]);

  const formatDart = (segment: string) => {
    if (segment === 'MISS') return 'MISS';
    if (segment === 'S25') return 'BULL';
    if (segment === 'D25') return 'DBULL';
    return segment;
  };

  // Render mark icon
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

      {/* BACKGROUND IMAGE (instead of split-screen video) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Game Type Header */}
      <div style={{
        position: 'absolute',
        top: `calc(20 * ${scale})`,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: `calc(8 * ${scale}) calc(24 * ${scale})`,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: `calc(8 * ${scale})`,
        border: '1px solid rgba(255, 255, 255, 0.2)',
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
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          borderRadius: `calc(12 * ${scale})`,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
        }}>
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)' }} />
          <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.15)' }} />
          <div />
        </div>

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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {renderMarkIcon('p1', target)}
                </div>
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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
            background: 'rgba(0, 0, 0, 0.7)',
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
            background: 'rgba(0, 0, 0, 0.7)',
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

      {/* Darts display */}
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
            background: PLAYERS.p1.profilecolor, transition: 'width 0.2s ease-out', zIndex: 5,
          }} />
        )}
        {introComplete && p1Exiting && (
          <div key={`p1-exit-${turnKey}`} style={{
            position: 'absolute', top: 0, left: 0, height: '3px', width: '100%',
            background: PLAYERS.p1.profilecolor, zIndex: 5, animation: 'borderDrainDown 0.5s ease-out forwards',
          }} />
        )}
        {introComplete && (p1Active || p1Exiting) && (
          <div key={`p1-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(179.4deg, ${PLAYERS.p1.profilecolor}33 0.52%, rgba(0, 0, 0, 0.2) 95.46%)`,
            animation: p1Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
          }} />
        )}
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
            background: '#000', border: `3px solid ${PLAYERS.p1.profilecolor}`, borderRadius: '50%', zIndex: 2,
            animation: p1Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
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

      {/* Player 2 Bar - Right - Hidden in solo mode */}
      {!isSoloMode && PLAYERS.p2 && (
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
              background: PLAYERS.p2.profilecolor, transition: 'width 0.2s ease-out', zIndex: 5,
            }} />
          )}
          {introComplete && p2Exiting && (
            <div key={`p2-exit-${turnKey}`} style={{
              position: 'absolute', top: 0, right: 0, height: '3px', width: '100%',
              background: PLAYERS.p2.profilecolor, zIndex: 5, animation: 'borderDrainDown 0.5s ease-out forwards',
            }} />
          )}
          {introComplete && (p2Active || p2Exiting) && (
            <div key={`p2-bar-${turnKey}`} style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(179.4deg, ${PLAYERS.p2.profilecolor}33 0.52%, rgba(0, 0, 0, 0.2) 95.46%)`,
              animation: p2Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
            }} />
          )}
          <span style={{
            position: 'absolute', left: `calc(20 * ${scale})`,
            top: '50%', transform: 'translateY(-50%)',
            fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
            lineHeight: 1, color: p2Active ? '#FFFFFF' : INACTIVE,
            textShadow: p2Active ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
          }}>
            {p2Score}
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
              background: '#000', border: `3px solid ${PLAYERS.p2.profilecolor}`, borderRadius: '50%', zIndex: 2,
              animation: p2Active ? 'colorSwipeUp 0.5s ease-out forwards' : 'colorSwipeDown 0.5s ease-out forwards',
            }} />
          )}
        </div>
      )}

      {/* Hamburger Menu */}
      <div style={{ position: 'absolute', top: `calc(20 * ${scale})`, right: `calc(20 * ${scale})`, zIndex: 100 }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: `calc(44 * ${scale})`, height: `calc(44 * ${scale})`,
            background: 'rgba(0, 0, 0, 0.5)', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            gap: `calc(6 * ${scale})`, padding: `calc(8 * ${scale})`, borderRadius: `calc(8 * ${scale})`,
          }}
        >
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFF', borderRadius: '2px' }} />
          <span style={{ width: `calc(28 * ${scale})`, height: '3px', background: '#FFF', borderRadius: '2px' }} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: `calc(50 * ${scale})`, right: 0,
            background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(12px)',
            borderRadius: `calc(8 * ${scale})`, border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden', minWidth: `calc(160 * ${scale})`,
          }}>
            <button
              onClick={() => { setMenuOpen(false); onLeaveMatch(); }}
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
      {activeAnimation && PLAYERS[currentThrower] && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle, ${PLAYERS[currentThrower]!.profilecolor}33 0%, transparent 70%)`,
            animation: 'achievementPulse 2s ease-out forwards',
          }} />
          {/* Award video if available */}
          {AWARD_VIDEOS[activeAnimation] && (
            <video
              autoPlay
              muted
              playsInline
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                maxWidth: '600px',
                zIndex: 201,
                animation: 'achievementPulse 2s ease-out forwards',
              }}
            >
              <source src={AWARD_VIDEOS[activeAnimation]} type="video/mp4" />
            </video>
          )}
          {/* Achievement text (only show if no video) */}
          {!AWARD_VIDEOS[activeAnimation] && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(120 * ${scale})`, lineHeight: 1,
              color: PLAYERS[currentThrower]!.profilecolor,
              textShadow: `0 0 30px ${PLAYERS[currentThrower]!.profilecolor}, 0 0 60px ${PLAYERS[currentThrower]!.profilecolor}, -4px 4px 8px rgba(0, 0, 0, 0.8)`,
              whiteSpace: 'nowrap',
              animation: 'achievementPulse 2s ease-out forwards, achievementGlow 0.5s ease-in-out infinite',
            }}>
              {ACHIEVEMENT_LABELS[activeAnimation]}
            </div>
          )}
        </div>
      )}

      {/* Winner Screen */}
      {(() => {
        const winnerPlayer = gameWinner ? PLAYERS[gameWinner] : null;
        if (!showWinnerScreen || !gameWinner || !winnerPlayer) return null;
        return (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 300,
            background: 'rgba(0, 0, 0, 0.9)', animation: 'winnerFadeIn 0.5s ease-out forwards',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at center, ${winnerPlayer.profilecolor}40 0%, transparent 60%)`,
            }} />
            <div style={{
              fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(60 * ${scale})`, lineHeight: 1,
              color: 'rgba(255, 255, 255, 0.6)', letterSpacing: `calc(20 * ${scale})`,
              marginBottom: `calc(20 * ${scale})`,
              animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.2s', opacity: 0,
            }}>
              {isSoloMode ? 'GAME COMPLETE' : 'WINNER'}
            </div>
            <div style={{
              fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(160 * ${scale})`, lineHeight: 1,
              color: winnerPlayer.profilecolor,
              textShadow: `0 0 40px ${winnerPlayer.profilecolor}, 0 0 80px ${winnerPlayer.profilecolor}, -6px 6px 12px rgba(0, 0, 0, 0.8)`,
              animation: 'winnerNameSlide 0.8s ease-out forwards', animationDelay: '0.4s', opacity: 0,
            }}>
              {winnerPlayer.name}
            </div>
            <div style={{
              fontFamily: FONT_NAME, fontSize: `calc(28 * ${scale})`, color: 'rgba(255, 255, 255, 0.5)',
              marginTop: `calc(30 * ${scale})`,
              animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.6s', opacity: 0,
            }}>
              {isSoloMode
                ? `Rounds: ${currentRound} | MPR: ${p1MPR}`
                : `Final: ${gameWinner === 'p1' ? p1Score : p2Score} - ${gameWinner === 'p1' ? p2Score : p1Score}`
              }
            </div>
            <div style={{
              display: 'flex', gap: `calc(20 * ${scale})`, marginTop: `calc(60 * ${scale})`,
              animation: 'winnerNameSlide 0.6s ease-out forwards', animationDelay: '0.8s', opacity: 0,
            }}>
              {onGameComplete ? (
                <button
                  onClick={() => {
                    setShowWinnerScreen(false);
                    setGameWinner(null);
                    onGameComplete(gameWinner);
                  }}
                  style={{
                    padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                    fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                    color: '#FFFFFF', background: winnerPlayer.profilecolor,
                    border: 'none', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                    boxShadow: `0 0 30px ${winnerPlayer.profilecolor}80`,
                  }}
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={onLeaveMatch}
                  style={{
                    padding: `calc(16 * ${scale}) calc(48 * ${scale})`,
                    fontFamily: FONT_NAME, fontSize: `calc(24 * ${scale})`, fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.7)', background: 'transparent',
                    border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: `calc(12 * ${scale})`, cursor: 'pointer',
                  }}
                >
                  Exit
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* DEV MODE: Dart Simulator */}
      {isDevMode() && (
        <DartSimulator
          onThrow={(segment, _score, multiplier) => applyThrow(segment, multiplier)}
          disabled={showPlayerChange || !introComplete || showWinnerScreen || !!activeAnimation}
        />
      )}
    </div>
  );
}

// Dev mode dart simulator
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

  const cricketNumbers = [20, 19, 18, 17, 16, 15];

  return (
    <div style={{
      position: 'fixed',
      bottom: expanded ? 0 : '-220px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '600px',
      maxWidth: '90vw',
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(12px)',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderBottom: 'none',
      padding: '12px 16px 16px',
      zIndex: 500,
      transition: 'bottom 0.3s ease-out',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          position: 'absolute',
          top: '-32px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderBottom: 'none',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          padding: '6px 20px',
          color: '#fff',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: "'Helvetica Condensed', sans-serif",
        }}
      >
        {expanded ? 'Hide Simulator' : 'Show Simulator'}
      </button>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
        {(['single', 'double', 'triple'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMultiplierMode(mode)}
            disabled={disabled}
            style={{
              padding: '6px 16px',
              background: multiplierMode === mode ? (mode === 'triple' ? '#FF4444' : mode === 'double' ? '#44FF44' : '#6600FF') : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'Helvetica Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              opacity: disabled ? 0.5 : 1,
              textTransform: 'uppercase',
            }}
          >
            {mode === 'single' ? 'Single (S)' : mode === 'double' ? 'Double (D)' : 'Triple (T)'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
        {cricketNumbers.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)}
            disabled={disabled}
            style={{
              width: '44px',
              height: '36px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'Helvetica Condensed', sans-serif",
              fontSize: '16px',
              fontWeight: 600,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={() => handleBullClick(false)}
          disabled={disabled}
          style={{
            padding: '8px 20px',
            background: '#228B22',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          BULL (25)
        </button>
        <button
          onClick={() => handleBullClick(true)}
          disabled={disabled}
          style={{
            padding: '8px 20px',
            background: '#FF4444',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          D-BULL (50)
        </button>
        <button
          onClick={handleMissClick}
          disabled={disabled}
          style={{
            padding: '8px 20px',
            background: 'rgba(100, 100, 100, 0.5)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Helvetica Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          MISS
        </button>
      </div>
    </div>
  );
}

export default CRInhouseGameScreen;
