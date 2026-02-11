import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useBLE } from '../contexts/BLEContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGameStatus } from '../hooks/useGameStatus';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { UserMenu, type CustomMenuItem } from './UserMenu';
import { Bluetooth, X, WifiOff, RefreshCw, DoorOpen } from 'lucide-react';
import type { DartThrowData } from '../utils/ble/bleConnection';
import { isDevMode } from '../utils/devMode';
import { playSound } from '../utils/sounds';
import { createClient } from '../utils/supabase/client';

interface CorkScreenProps {
  player1: { id: string; granboard_name: string; profilepic?: string; profilecolor: string };
  player2: { id: string; granboard_name: string; profilepic?: string; profilecolor: string };
  gameId: string;
  visiblePlayerId: string;
  isInitiator: boolean;
  onCorkComplete: (firstPlayerId: string) => void;
  onCancel: () => void;
}

interface PlayerCorkState {
  status: 'waiting' | 'thrown';
  score: number | null;
  wasValid: boolean;
  display: string;
}

interface CorkThrowMessage {
  playerId: string;
  score: number;
  wasValid: boolean;
  display: string;
  timestamp: string;
  round: number;
}

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

// CSS keyframes for animations
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
@keyframes winnerOmbre {
  0% { clip-path: inset(0 0 100% 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes tiePulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.05); }
}
`;

function getCorkScore(throwData: DartThrowData): { score: number; valid: boolean; display: string } {
  const { segmentType, baseValue } = throwData;
  if (segmentType === 'SINGLE_INNER') return { score: baseValue, valid: true, display: `${baseValue}` };
  if (segmentType === 'BULL') return { score: 25, valid: true, display: '25' };
  if (segmentType === 'DBL_BULL') return { score: 50, valid: true, display: '50' };
  // Invalid throws all score 0
  return { score: 0, valid: false, display: '0' };
}

import { resolveProfilePicUrl } from '../utils/profile';

const GREY = '#7E7E7E';
const FONT_NAME = "'Helvetica Condensed', 'Helvetica', Arial, sans-serif";
const FONT_SCORE = "'Helvetica Compressed', 'Helvetica', Arial, sans-serif";

const FIGMA = {
  frame: { w: 1180, h: 820 },
  bar: { w: 450, h: 90 },
  avatar: 60,
  avatarLeft: 10,
  nameLeft: 80,
  nameSize: 32,
  scoreSize: 72,
};

export function CorkScreen({ player1, player2, gameId, visiblePlayerId, isInitiator, onCorkComplete, onCancel }: CorkScreenProps) {
  const { lastThrow, isConnected, connect, disconnect: bleDisconnect, status: bleStatus } = useBLE();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const player1Name = typeof player1.granboard_name === 'string' && player1.granboard_name.trim() ? player1.granboard_name.trim() : 'Player 1';
  const player2Name = typeof player2.granboard_name === 'string' && player2.granboard_name.trim() ? player2.granboard_name.trim() : 'Player 2';
  const remotePlayerId = visiblePlayerId === player1.id ? player2.id : player1.id;
  const remotePlayerName = visiblePlayerId === player1.id ? player2Name : player1Name;


  // Memoize WebRTC options to prevent infinite re-initialization loop
  const webRTCOptions = useMemo(() => ({
    gameId, localPlayerId: visiblePlayerId, remotePlayerId, isInitiator
  }), [gameId, visiblePlayerId, remotePlayerId, isInitiator]);

  const { localStream, remoteStream, connectionState, error, initialize, disconnect: webrtcDisconnect } = useWebRTC(webRTCOptions);

  const handleCancel = useCallback(async () => {
    await webrtcDisconnect();
    onCancel();
  }, [webrtcDisconnect, onCancel]);

  const { isOpponentOnline, disconnectCountdown, leaveMatch, opponentLeftMessage } = useGameStatus({
    gameId,
    localPlayerId: visiblePlayerId,
    remotePlayerId,
    remotePlayerName,
    onOpponentLeft: handleCancel,
    onOpponentDisconnected: () => console.log('[CorkScreen] Opponent disconnected'),
    onOpponentReconnected: () => console.log('[CorkScreen] Opponent reconnected'),
  });

  const [p1State, setP1State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '-' });
  const [p2State, setP2State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '-' });
  const [tieAlert, setTieAlert] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastTs, setLastTs] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [corkRound, setCorkRound] = useState(1);
  const [myThrowSent, setMyThrowSent] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const devMode = isDevMode();

  // Phase-based intro animation (0=nothing, 1=cams slide in + bars slide up, 2=colors revealed)
  const [phase, setPhase] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [p1CamPopped, setP1CamPopped] = useState(false);
  const [p2CamPopped, setP2CamPopped] = useState(false);
  const [turnKey, setTurnKey] = useState(0);

  // Responsive scaling - use CSS calc like preview
  const scale = `calc(100vw / ${FIGMA.frame.w})`;
  const greyGradient = 'linear-gradient(179.4deg, rgba(126, 126, 126, 0.2) 0.52%, rgba(0, 0, 0, 0.2) 95.46%)';

  // Intro animation sequence
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => { setPhase(1); playSound('corkLoading'); }, 200));
    timers.push(setTimeout(() => setPhase(2), 1000));
    return () => timers.forEach(clearTimeout);
  }, [animKey]);

  // Determine if local player is P1 or P2
  const amP1 = visiblePlayerId === player1.id;

  // WHO SENT THE REQUEST (isInitiator) is ALWAYS on LEFT
  // WHO ACCEPTED THE REQUEST is ALWAYS on RIGHT
  // If I sent request (isInitiator=true): my camera on left, opponent on right
  // If I accepted request (isInitiator=false): opponent camera on left (they sent it), my camera on right
  const localIsLeft = isInitiator;

  // Determine which player data goes on which side
  const myPlayerData = amP1 ? player1 : player2;
  const opponentData = amP1 ? player2 : player1;
  const myPlayerName = amP1 ? player1Name : player2Name;
  const opponentName = amP1 ? player2Name : player1Name;

  // Left = request sender (initiator), Right = request accepter
  const leftPlayerData = isInitiator ? myPlayerData : opponentData;
  const rightPlayerData = isInitiator ? opponentData : myPlayerData;
  const leftPlayerName = isInitiator ? myPlayerName : opponentName;
  const rightPlayerName = isInitiator ? opponentName : myPlayerName;

  // Map states to left/right based on which player is where
  const getLeftState = () => leftPlayerData.id === player1.id ? p1State : p2State;
  const getRightState = () => rightPlayerData.id === player1.id ? p1State : p2State;
  const leftCamPopped = leftPlayerData.id === player1.id ? p1CamPopped : p2CamPopped;
  const rightCamPopped = rightPlayerData.id === player1.id ? p1CamPopped : p2CamPopped;

  // Local player info for UserMenu
  const localPlayerName = myPlayerName;
  const localPlayerPic = myPlayerData.profilepic;
  const localPlayerColor = myPlayerData.profilecolor;

  // Send cork throw to Supabase channel
  const sendCorkThrow = useCallback(async (score: number, wasValid: boolean, display: string) => {
    if (!channelRef.current || myThrowSent) return;

    const message: CorkThrowMessage = {
      playerId: visiblePlayerId,
      score,
      wasValid,
      display,
      timestamp: new Date().toISOString(),
      round: corkRound,
    };

    console.log('[Cork] Sending throw:', message);
    await channelRef.current.send({
      type: 'broadcast',
      event: 'cork_throw',
      payload: message,
    });
    setMyThrowSent(true);

    // Update local state for my throw
    if (amP1) {
      setP1State({ status: 'thrown', score, wasValid, display });
      setP1CamPopped(true);
    } else {
      setP2State({ status: 'thrown', score, wasValid, display });
      setP2CamPopped(true);
    }
  }, [channelRef, myThrowSent, visiblePlayerId, corkRound, amP1]);

  // Dev mode: simulate a throw
  const simulateThrow = (type: 'inner' | 'bull' | 'dblbull' | 'miss', value: number = 20) => {
    if (myThrowSent) return;

    const segmentTypes: Record<string, DartThrowData['segmentType']> = {
      inner: 'SINGLE_INNER',
      bull: 'BULL',
      dblbull: 'DBL_BULL',
      miss: 'MISS',
    };
    const fakeThrow: DartThrowData = {
      segment: type === 'bull' ? 'BULL' : type === 'dblbull' ? 'DBL_BULL' : `S${value}`,
      score: type === 'bull' ? 25 : type === 'dblbull' ? 50 : type === 'miss' ? 0 : value,
      multiplier: type === 'dblbull' ? 2 : 1,
      baseValue: type === 'bull' || type === 'dblbull' ? 25 : value,
      segmentType: segmentTypes[type],
      dartNum: 1,
      timestamp: new Date().toISOString(),
    };
    const { score, valid, display } = getCorkScore(fakeThrow);
    playSound('corkHit');
    sendCorkThrow(score, valid, display);
  };

  // Subscribe to cork channel for throw sync
  useEffect(() => {
    const channelName = `cork:${gameId}`;
    console.log(`[Cork] Subscribing to channel: ${channelName}`);

    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'cork_throw' }, ({ payload }) => {
        const msg = payload as CorkThrowMessage;
        console.log('[Cork] Received throw:', msg);

        if (msg.round !== corkRound) {
          console.log('[Cork] Ignoring throw from different round');
          return;
        }

        if (msg.playerId === player1.id) {
          setP1State({ status: 'thrown', score: msg.score, wasValid: msg.wasValid, display: msg.display });
          setP1CamPopped(true);
        } else if (msg.playerId === player2.id) {
          setP2State({ status: 'thrown', score: msg.score, wasValid: msg.wasValid, display: msg.display });
          setP2CamPopped(true);
        }
      })
      .subscribe((status) => {
        console.log(`[Cork] Channel subscription status: ${status}`);
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [gameId, corkRound, player1.id, player2.id]);

  // Initialize WebRTC
  // Start WebRTC once; do NOT disconnect on unmount so camera carries over to game screen
  useEffect(() => {
    initialize();
    return () => { /* leave connection alive for Game screen */ };
  }, [initialize]);

  // Request fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } catch {
        // Fullscreen may fail if no user interaction yet
      }
    };
    enterFullscreen();

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Prevent browser back button and refresh during cork
  useEffect(() => {
    // Block back button by pushing state and handling popstate
    const blockBackButton = () => {
      window.history.pushState(null, '', window.location.href);
    };

    const handlePopState = () => {
      blockBackButton();
    };

    // Warn on refresh/close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    // Initialize
    blockBackButton();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  // Attach remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Handle BLE throws
  useEffect(() => {
    if (!lastThrow || winner || myThrowSent) return;

    const throwTime = new Date(lastThrow.timestamp).getTime();
    if (throwTime <= mountTimeRef.current) return;

    if (lastThrow.timestamp === lastTs) return;
    setLastTs(lastThrow.timestamp);

    if (lastThrow.segmentType === 'BUTTON' || lastThrow.segment === 'BTN') {
      sendCorkThrow(0, false, '0');
      return;
    }

    const { score, valid, display } = getCorkScore(lastThrow);
    playSound('corkHit');
    sendCorkThrow(score, valid, display);
  }, [lastThrow, lastTs, winner, myThrowSent, sendCorkThrow]);

  // Check for winner when both have thrown
  useEffect(() => {
    if (p1State.status !== 'thrown' || p2State.status !== 'thrown' || p1State.score === null || p2State.score === null || winner) return;

    // Show "?" for opponent for 1 second before revealing both scores
    setTimeout(() => {
      setRevealed(true);
      setTimeout(() => {
        if (p1State.score! > p2State.score!) {
          playSound('corkWinner');
          setWinner(player1.id);
          setTimeout(() => onCorkComplete(player1.id), 2500);
        } else if (p2State.score! > p1State.score!) {
          playSound('corkWinner');
          setWinner(player2.id);
          setTimeout(() => onCorkComplete(player2.id), 2500);
        } else {
          setTieAlert(true);
          setTimeout(() => {
            setTieAlert(false);
            setRevealed(false);
            setP1State({ status: 'waiting', score: null, wasValid: false, display: '-' });
            setP2State({ status: 'waiting', score: null, wasValid: false, display: '-' });
            setP1CamPopped(false);
            setP2CamPopped(false);
            setCorkRound(r => r + 1);
            setTurnKey(k => k + 1);
            setMyThrowSent(false);
          }, 2500);
        }
      }, 1000);
    }, 1000);
  }, [p1State, p2State, winner, player1.id, player2.id, onCorkComplete]);

  // Score display logic - show ? for opponent until both thrown
  const getScoreDisplay = (state: PlayerCorkState, playerId: string): string => {
    if (state.status === 'waiting') return '-';
    if (revealed) return state.display;
    // Show own score, but ? for opponent until both have thrown
    return playerId === visiblePlayerId ? state.display : '?';
  };

  // Score color - profile color when shown, white dash otherwise
  const getScoreColor = (state: PlayerCorkState, playerId: string, accentColor: string): string => {
    if (state.status === 'waiting') return '#FFFFFF';
    if (revealed || playerId === visiblePlayerId) return accentColor;
    return '#FFFFFF';
  };

  const handleConfirmLeave = async () => {
    setShowLeaveConfirm(false);
    await webrtcDisconnect();
    await leaveMatch();
    onCancel();
  };

  const handleRefreshVideo = async () => {
    await webrtcDisconnect();
    await initialize();
  };

  // Custom menu items for UserMenu
  const customMenuItems: CustomMenuItem[] = useMemo(() => [
    {
      label: 'Refresh Video',
      icon: RefreshCw,
      onClick: handleRefreshVideo,
    },
    {
      label: 'Leave Match',
      icon: DoorOpen,
      onClick: () => setShowLeaveConfirm(true),
      className: 'focus:bg-red-500/20 focus:text-white text-red-400 cursor-pointer',
    },
  ], []);

  const handleLogoutAction = () => setShowLeaveConfirm(true);

  // Determine states for UI
  const colorsRevealed = phase >= 2;
  const leftState = getLeftState();
  const rightState = getRightState();

  // Winner/loser based on left/right positions
  const leftIsWinner = winner === leftPlayerData.id;
  const rightIsWinner = winner === rightPlayerData.id;
  const leftIsLoser = winner !== null && !leftIsWinner;
  const rightIsLoser = winner !== null && !rightIsWinner;

  // Active states for bars (colors show when phase >= 2 and not loser)
  const leftActive = colorsRevealed && !leftIsLoser;
  const rightActive = colorsRevealed && !rightIsLoser;

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Inject keyframes */}
      <style>{corkKeyframes}</style>

      {/* Game screen background overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url('/assets/gamescreenbackground.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-white text-lg font-bold mb-2">Leave Match?</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Your opponent will be notified and the match will be cancelled.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors">
                Stay
              </button>
              <button onClick={handleConfirmLeave} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Disconnected Countdown Overlay */}
      {disconnectCountdown !== null && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-yellow-600 rounded-xl p-6 max-w-sm w-full text-center">
            <WifiOff className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Opponent Disconnected</h2>
            <p className="text-zinc-400 text-sm mb-4">Waiting for {remotePlayerName} to reconnect...</p>
            <div className="text-4xl font-bold text-yellow-500 mb-2">{disconnectCountdown}s</div>
            <p className="text-zinc-500 text-xs">Match will end if they don't return</p>
          </div>
        </div>
      )}

      {/* Opponent Left Message Overlay */}
      {opponentLeftMessage && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-600 rounded-xl p-6 max-w-sm w-full text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Match Ended</h2>
            <p className="text-zinc-400 text-sm">{opponentLeftMessage}</p>
            <p className="text-zinc-500 text-xs mt-3">Returning to lobby...</p>
          </div>
        </div>
      )}

      {/* BLE Disconnected Overlay - skip in dev mode */}
      {!isConnected && !devMode && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-blue-600 rounded-xl p-6 max-w-sm w-full text-center">
            <Bluetooth className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Board Disconnected</h2>
            <p className="text-zinc-400 text-sm mb-4">Your Granboard connection was lost. Reconnect to continue playing.</p>
            <button
              onClick={connect}
              disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {bleStatus === 'connecting' || bleStatus === 'scanning' ? 'Connecting...' : 'Reconnect Board'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', height: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setShowLeaveConfirm(true)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <ChevronLeft size={24} />
          </button>
          {/* BLE Status */}
          <button
            onClick={async () => {
              if (isConnected) {
                await bleDisconnect();
              } else {
                await connect();
              }
            }}
            disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: bleStatus === 'connecting' || bleStatus === 'scanning' ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            <Bluetooth
              size={16}
              style={{
                color: isConnected ? '#10b981' : bleStatus === 'connecting' || bleStatus === 'scanning' ? '#f59e0b' : '#ef4444',
              }}
            />
            <span style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '12px',
              color: isConnected ? '#10b981' : bleStatus === 'connecting' || bleStatus === 'scanning' ? '#f59e0b' : '#ef4444',
            }}>
              {isConnected ? 'Connected' : bleStatus === 'connecting' ? 'Connecting...' : bleStatus === 'scanning' ? 'Scanning...' : 'Disconnected'}
            </span>
          </button>
        </div>
        <h1 style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#fff',
          fontFamily: FONT_NAME,
          fontSize: '18px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: 0,
        }}>
          THROW CORK{corkRound > 1 ? ` R${corkRound}` : ''}
        </h1>
        <UserMenu
          profilepic={resolveProfilePicUrl(localPlayerPic)}
          profilecolor={localPlayerColor}
          granboard_name={localPlayerName}
          onLogout={handleLogoutAction}
          customItems={customMenuItems}
          size="sm"
        />
      </div>

      {/* Opponent offline indicator */}
      {!isOpponentOnline && disconnectCountdown === null && (
        <div style={{
          position: 'absolute',
          top: `calc(130 * ${scale})`,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(202, 138, 4, 0.2)',
          border: '1px solid #ca8a04',
          borderRadius: '8px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 20,
        }}>
          <WifiOff size={14} className="text-yellow-500" />
          <span style={{ color: '#eab308', fontSize: '14px' }}>{remotePlayerName} appears offline</span>
        </div>
      )}

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

      {/* CAM 1 - flush left (REQUEST SENDER / INITIATOR) */}
      <div
        key={`cam1-${animKey}`}
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: phase >= 1 ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-100%)',
          width: `calc(${FIGMA.bar.w + 50} * ${scale})`,
          height: `calc((${FIGMA.bar.w + 50} * ${scale}) * 9 / 16)`,
          zIndex: 10,
          transition: 'transform 0.6s ease-out',
        }}
      >
        {/* Winner overlay gradient */}
        {leftIsWinner && (
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0, left: 0,
            zIndex: 20,
            borderTopRightRadius: `calc(10 * ${scale})`,
            borderBottomRightRadius: `calc(10 * ${scale})`,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, ${withAlpha(leftPlayerData.profilecolor, 0.75)} 0%, ${withAlpha(leftPlayerData.profilecolor, 0.25)} 15%, transparent 25%)`,
            borderTop: `2px solid ${leftPlayerData.profilecolor}`,
            borderRight: `2px solid ${leftPlayerData.profilecolor}`,
            borderBottom: `2px solid ${leftPlayerData.profilecolor}`,
            borderLeft: 'none',
            animation: 'winnerOmbre 0.5s ease-out forwards',
          }} />
        )}
        {leftIsWinner && (
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
          overflow: 'hidden',
          border: `2px solid ${leftIsLoser ? GREY : (leftCamPopped ? leftPlayerData.profilecolor : GREY)}`,
          borderLeft: 'none',
          opacity: leftIsLoser ? 0.4 : 1,
          transition: leftIsLoser ? 'opacity 0.15s ease, border-color 0.15s ease' : 'border-color 0.3s ease',
        }}>
          {localIsLeft ? (
            localStream ? (
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'none' }} />
            ) : (
              <Avatar style={{ width: '80px', height: '80px' }}>
                <AvatarImage src={resolveProfilePicUrl(leftPlayerData.profilepic)} />
                <AvatarFallback className="bg-zinc-800 text-white text-2xl">{leftPlayerName.charAt(0)}</AvatarFallback>
              </Avatar>
            )
          ) : (
            remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Avatar style={{ width: '80px', height: '80px' }}>
                <AvatarImage src={resolveProfilePicUrl(leftPlayerData.profilepic)} />
                <AvatarFallback className="bg-zinc-800 text-white text-2xl">{leftPlayerName.charAt(0)}</AvatarFallback>
              </Avatar>
            )
          )}
        </div>
      </div>

      {/* CAM 2 - flush right (REQUEST ACCEPTER) */}
      <div
        key={`cam2-${animKey}`}
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: phase >= 1 ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(100%)',
          width: `calc(${FIGMA.bar.w + 50} * ${scale})`,
          height: `calc((${FIGMA.bar.w + 50} * ${scale}) * 9 / 16)`,
          zIndex: 10,
          transition: 'transform 0.6s ease-out',
        }}
      >
        {/* Winner overlay gradient */}
        {rightIsWinner && (
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0, left: 0,
            zIndex: 20,
            borderTopLeftRadius: `calc(10 * ${scale})`,
            borderBottomLeftRadius: `calc(10 * ${scale})`,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, ${withAlpha(rightPlayerData.profilecolor, 0.75)} 0%, ${withAlpha(rightPlayerData.profilecolor, 0.25)} 15%, transparent 25%)`,
            borderTop: `2px solid ${rightPlayerData.profilecolor}`,
            borderLeft: `2px solid ${rightPlayerData.profilecolor}`,
            borderBottom: `2px solid ${rightPlayerData.profilecolor}`,
            borderRight: 'none',
            animation: 'winnerOmbre 0.5s ease-out forwards',
          }} />
        )}
        {rightIsWinner && (
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
          overflow: 'hidden',
          border: `2px solid ${rightIsLoser ? GREY : (rightCamPopped ? rightPlayerData.profilecolor : GREY)}`,
          borderRight: 'none',
          opacity: rightIsLoser ? 0.4 : 1,
          transition: rightIsLoser ? 'opacity 0.15s ease, border-color 0.15s ease' : 'border-color 0.3s ease',
        }}>
          {!localIsLeft ? (
            localStream ? (
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'none' }} />
            ) : (
              <Avatar style={{ width: '80px', height: '80px' }}>
                <AvatarImage src={resolveProfilePicUrl(rightPlayerData.profilepic)} />
                <AvatarFallback className="bg-zinc-800 text-white text-2xl">{rightPlayerName.charAt(0)}</AvatarFallback>
              </Avatar>
            )
          ) : (
            remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Avatar style={{ width: '80px', height: '80px' }}>
                <AvatarImage src={resolveProfilePicUrl(rightPlayerData.profilepic)} />
                <AvatarFallback className="bg-zinc-800 text-white text-2xl">{rightPlayerName.charAt(0)}</AvatarFallback>
              </Avatar>
            )
          )}
        </div>
      </div>

      {/* ===== PLAYER BARS ===== */}

      {/* Left Bar - REQUEST SENDER (INITIATOR) */}
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
          borderTop: `2px solid ${leftActive ? leftPlayerData.profilecolor : GREY}`,
          borderRight: `2px solid ${leftActive ? leftPlayerData.profilecolor : GREY}`,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.6s ease-out, border-color 0.3s ease',
          zIndex: 20,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {colorsRevealed && leftActive && (
          <div key={`left-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(leftPlayerData.profilecolor, 0.25)} 0%, ${withAlpha(leftPlayerData.profilecolor, 0.13)} 50%, transparent 100%)`,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        {/* Avatar grey base */}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          background: '#000', border: `3px solid ${GREY}`, borderRadius: '50%', zIndex: 1,
          overflow: 'hidden',
        }}>
          <Avatar className="w-full h-full">
            <AvatarImage src={resolveProfilePicUrl(leftPlayerData.profilepic)} />
            <AvatarFallback className="bg-zinc-800 text-white">{leftPlayerName.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
        {/* Avatar color overlay */}
        {colorsRevealed && leftActive && (
          <div key={`left-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            left: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            background: '#000', border: `3px solid ${leftPlayerData.profilecolor}`, borderRadius: '50%', zIndex: 2,
            overflow: 'hidden',
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }}>
            <Avatar className="w-full h-full">
              <AvatarImage src={resolveProfilePicUrl(leftPlayerData.profilepic)} />
              <AvatarFallback className="bg-zinc-800 text-white">{leftPlayerName.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        )}
        {/* Name */}
        <div style={{
          position: 'absolute', left: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: leftActive ? '#FFFFFF' : GREY,
          }}>
            {leftPlayerName}
          </span>
        </div>
        {/* Score */}
        <span style={{
          position: 'absolute', right: `calc(20 * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1,
          color: leftState.status === 'thrown' && leftActive ? leftPlayerData.profilecolor : (leftActive ? '#FFFFFF' : GREY),
          textShadow: leftActive ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {getScoreDisplay(leftState, leftPlayerData.id)}
        </span>
      </div>

      {/* Right Bar - REQUEST ACCEPTER */}
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
          borderTop: `2px solid ${rightActive ? rightPlayerData.profilecolor : GREY}`,
          borderLeft: `2px solid ${rightActive ? rightPlayerData.profilecolor : GREY}`,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.6s ease-out, border-color 0.3s ease',
          zIndex: 20,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: greyGradient }} />
        {colorsRevealed && rightActive && (
          <div key={`right-bar-${turnKey}`} style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(rightPlayerData.profilecolor, 0.25)} 0%, ${withAlpha(rightPlayerData.profilecolor, 0.13)} 50%, transparent 100%)`,
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }} />
        )}
        {/* Score */}
        <span style={{
          position: 'absolute', left: `calc(10 * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          fontFamily: FONT_SCORE, fontWeight: 300, fontSize: `calc(${FIGMA.scoreSize} * ${scale})`,
          lineHeight: 1,
          color: rightState.status === 'thrown' && rightActive ? rightPlayerData.profilecolor : (rightActive ? '#FFFFFF' : GREY),
          textShadow: rightActive ? '-6px 6px 9.7px rgba(0, 0, 0, 0.78)' : 'none', zIndex: 3,
        }}>
          {getScoreDisplay(rightState, rightPlayerData.id)}
        </span>
        {/* Name */}
        <div style={{
          position: 'absolute', right: `calc(${FIGMA.nameLeft} * ${scale})`,
          top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 3,
        }}>
          <span style={{
            fontFamily: FONT_NAME, fontWeight: 400, fontSize: `calc(${FIGMA.nameSize} * ${scale})`,
            color: rightActive ? '#FFFFFF' : GREY,
          }}>
            {rightPlayerName}
          </span>
        </div>
        {/* Avatar grey base */}
        <div style={{
          position: 'absolute',
          width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
          right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
          background: '#000', border: `3px solid ${GREY}`, borderRadius: '50%', zIndex: 1,
          overflow: 'hidden',
        }}>
          <Avatar className="w-full h-full">
            <AvatarImage src={resolveProfilePicUrl(rightPlayerData.profilepic)} />
            <AvatarFallback className="bg-zinc-800 text-white">{rightPlayerName.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
        {/* Avatar color overlay */}
        {colorsRevealed && rightActive && (
          <div key={`right-avatar-${turnKey}`} style={{
            position: 'absolute',
            width: `calc(${FIGMA.avatar} * ${scale})`, height: `calc(${FIGMA.avatar} * ${scale})`,
            right: `calc(${FIGMA.avatarLeft} * ${scale})`, top: '50%', transform: 'translateY(-50%)',
            background: '#000', border: `3px solid ${rightPlayerData.profilecolor}`, borderRadius: '50%', zIndex: 2,
            overflow: 'hidden',
            animation: 'colorSwipeUp 0.5s ease-out forwards',
          }}>
            <Avatar className="w-full h-full">
              <AvatarImage src={resolveProfilePicUrl(rightPlayerData.profilepic)} />
              <AvatarFallback className="bg-zinc-800 text-white">{rightPlayerName.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Dev Mode Throw Simulator - compact, right side */}
      {devMode && (
        <div
          className="absolute bottom-28 right-4 p-2 bg-orange-900/70 border border-orange-600 rounded-lg z-30"
          style={{ width: '140px' }}
        >
          <p className="text-orange-400 text-[10px] font-bold mb-1 text-center">
            DEV {myThrowSent ? '(SENT)' : ''}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {[5, 10, 20].map(v => (
              <button
                key={v}
                onClick={() => simulateThrow('inner', v)}
                disabled={myThrowSent}
                className="px-1 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-[10px] rounded"
              >
                {v}
              </button>
            ))}
            <button
              onClick={() => simulateThrow('bull')}
              disabled={myThrowSent}
              className="px-1 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-[10px] rounded"
            >
              B
            </button>
            <button
              onClick={() => simulateThrow('dblbull')}
              disabled={myThrowSent}
              className="px-1 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-[10px] rounded"
            >
              DB
            </button>
            <button
              onClick={() => simulateThrow('miss')}
              disabled={myThrowSent}
              className="px-1 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-400 text-[10px] rounded"
            >
              0
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
