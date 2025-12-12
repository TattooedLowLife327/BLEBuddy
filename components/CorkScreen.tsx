import { useState, useEffect, useRef } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGameStatus } from '../hooks/useGameStatus';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Bluetooth, X, WifiOff } from 'lucide-react';
import type { DartThrowData } from '../utils/ble/bleConnection';
import { isDevMode } from '../utils/devMode';

interface CorkScreenProps {
  player1: { id: string; name: string; profilePic?: string; accentColor: string };
  player2: { id: string; name: string; profilePic?: string; accentColor: string };
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

function getCorkScore(throwData: DartThrowData): { score: number; valid: boolean; display: string } {
  const { segmentType, baseValue } = throwData;
  if (segmentType === 'SINGLE_INNER') return { score: baseValue, valid: true, display: `${baseValue}` };
  if (segmentType === 'BULL') return { score: 25, valid: true, display: 'BULL' };
  if (segmentType === 'DBL_BULL') return { score: 50, valid: true, display: 'D-BULL' };

  let display = '0';
  if (segmentType === 'TRIPLE') display = `T${baseValue} -> 0`;
  else if (segmentType === 'DOUBLE') display = `D${baseValue} -> 0`;
  else if (segmentType === 'SINGLE_OUTER') display = `outer ${baseValue} -> 0`;
  else if (segmentType === 'MISS') display = 'MISS -> 0';
  return { score: 0, valid: false, display };
}

const resolveProfilePicUrl = (pic?: string): string | undefined => {
  if (!pic) return undefined;
  if (pic.startsWith('http')) return pic;
  if (pic.startsWith('/assets') || pic.startsWith('assets')) return `https://llogb.netlify.app${pic.startsWith('/') ? pic : '/' + pic}`;
  if (pic === 'default-pfp.png') return '/default-pfp.png';
  return `https://sndsyxxcnuwjmjgikzgg.supabase.co/storage/v1/object/public/profilepic/${pic}`;
};

export function CorkScreen({ player1, player2, gameId, visiblePlayerId, isInitiator, onCorkComplete, onCancel }: CorkScreenProps) {
  const { lastThrow, isConnected, connect, status: bleStatus } = useBLE();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const remotePlayerId = visiblePlayerId === player1.id ? player2.id : player1.id;
  const remotePlayerName = visiblePlayerId === player1.id ? player2.name : player1.name;

  const { localStream, remoteStream, connectionState, error, initialize, disconnect } = useWebRTC({
    gameId, localPlayerId: visiblePlayerId, remotePlayerId, isInitiator
  });

  const { isOpponentOnline, disconnectCountdown, leaveMatch, opponentLeftMessage } = useGameStatus({
    gameId,
    localPlayerId: visiblePlayerId,
    remotePlayerId,
    remotePlayerName,
    onOpponentLeft: onCancel,
    onOpponentDisconnected: () => console.log('[CorkScreen] Opponent disconnected'),
    onOpponentReconnected: () => console.log('[CorkScreen] Opponent reconnected'),
  });

  const [p1State, setP1State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '--' });
  const [p2State, setP2State] = useState<PlayerCorkState>({ status: 'waiting', score: null, wasValid: false, display: '--' });
  const [tieAlert, setTieAlert] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [currentThrower, setCurrentThrower] = useState<1 | 2>(1);
  const [lastTs, setLastTs] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const devMode = isDevMode();

  // Dev mode: simulate a throw
  const simulateThrow = (type: 'inner' | 'bull' | 'dblbull' | 'miss', value: number = 20) => {
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
    if (currentThrower === 1 && p1State.status === 'waiting') {
      setP1State({ status: 'thrown', score, wasValid: valid, display });
      setCurrentThrower(2);
    } else if (currentThrower === 2 && p2State.status === 'waiting') {
      setP2State({ status: 'thrown', score, wasValid: valid, display });
    }
  };

  useEffect(() => { initialize(); return () => { disconnect(); }; }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!lastThrow || lastThrow.timestamp === lastTs || winner) return;
    setLastTs(lastThrow.timestamp);
    const { score, valid, display } = getCorkScore(lastThrow);
    if (currentThrower === 1 && p1State.status === 'waiting') {
      setP1State({ status: 'thrown', score, wasValid: valid, display });
      setCurrentThrower(2);
    } else if (currentThrower === 2 && p2State.status === 'waiting') {
      setP2State({ status: 'thrown', score, wasValid: valid, display });
    }
  }, [lastThrow]);

  useEffect(() => {
    if (p1State.status !== 'thrown' || p2State.status !== 'thrown' || p1State.score === null || p2State.score === null || winner) return;
    setRevealed(true);
    setTimeout(() => {
      if (p1State.score! > p2State.score!) { setWinner(player1.id); setTimeout(() => onCorkComplete(player1.id), 2000); }
      else if (p2State.score! > p1State.score!) { setWinner(player2.id); setTimeout(() => onCorkComplete(player2.id), 2000); }
      else {
        setTieAlert(true);
        setTimeout(() => {
          setTieAlert(false); setRevealed(false);
          setP1State({ status: 'waiting', score: null, wasValid: false, display: '--' });
          setP2State({ status: 'waiting', score: null, wasValid: false, display: '--' });
          setCurrentThrower(1);
        }, 2500);
      }
    }, 1000);
  }, [p1State, p2State]);

  const getDisplay = (state: PlayerCorkState, pid: string) => {
    if (state.status === 'waiting') return '--';
    if (revealed) return state.display;
    return pid === visiblePlayerId ? state.display : 'OK';
  };

  const isP1Local = player1.id === visiblePlayerId;

  const handleBLEConnect = async () => {
    const result = await connect();
    if (!result.success && result.error) {
      alert(`Connection failed: ${result.error}`);
    }
  };

  const handleLeaveClick = () => {
    setShowLeaveConfirm(true);
  };

  const handleConfirmLeave = async () => {
    setShowLeaveConfirm(false);
    await leaveMatch();
    onCancel();
  };

  const handleCancelLeave = () => {
    setShowLeaveConfirm(false);
  };

  const handleBLEReconnect = async () => {
    const result = await connect();
    if (!result.success && result.error) {
      alert(`Reconnection failed: ${result.error}`);
    }
  };

  const renderPlayer = (player: typeof player1, state: PlayerCorkState, pNum: 1 | 2, isLocal: boolean) => {
    const isThrowing = currentThrower === pNum && state.status === 'waiting';
    const showResult = revealed || player.id === visiblePlayerId;
    const borderColor = isThrowing ? 'border-yellow-400' : state.status === 'thrown' && showResult ? (state.wasValid ? 'border-green-500' : 'border-red-500') : 'border-zinc-700';

    return (
      <div className={`flex-1 p-3 rounded-xl border-2 ${borderColor} transition-colors`} style={{ backgroundColor: 'rgba(39,39,42,0.6)' }}>
        <div className="flex flex-col items-center">
          {/* Video feed */}
          <div className="w-full aspect-video bg-zinc-900 rounded-lg mb-2 overflow-hidden relative" style={{ borderColor: player.accentColor, borderWidth: '2px' }}>
            {isLocal ? (
              localStream ? <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs p-2 text-center">
                  {devMode ? 'No camera (dev mode)' : error || 'Starting camera...'}
                </div>
            ) : (
              remoteStream ? <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <Avatar className="w-12 h-12"><AvatarImage src={resolveProfilePicUrl(player.profilePic)} /><AvatarFallback className="bg-zinc-800 text-white text-lg">{player.name.charAt(0)}</AvatarFallback></Avatar>
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
              <p className="text-white font-semibold text-xs truncate">{player.name}</p>
            </div>
          </div>

          {/* Status */}
          <p className={`text-xs mb-1 ${isThrowing ? 'text-yellow-400 font-bold' : 'text-zinc-500'}`}>
            {state.status === 'thrown' ? (revealed ? '' : 'Thrown!') : isThrowing ? 'THROW NOW' : 'Waiting...'}
          </p>

          {/* Score */}
          <div className="text-2xl font-bold" style={{ color: state.status === 'waiting' ? '#71717a' : showResult ? (state.wasValid ? '#22c55e' : '#ef4444') : '#a1a1aa' }}>
            {getDisplay(state, player.id)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-white text-lg font-bold mb-2">Leave Match?</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Your opponent will be notified and the match will be cancelled.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
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
            <p className="text-zinc-400 text-sm mb-4">
              Waiting for {remotePlayerName} to reconnect...
            </p>
            <div className="text-4xl font-bold text-yellow-500 mb-2">
              {disconnectCountdown}s
            </div>
            <p className="text-zinc-500 text-xs">
              Match will end if they don't return
            </p>
          </div>
        </div>
      )}

      {/* Opponent Left Message Overlay */}
      {opponentLeftMessage && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-600 rounded-xl p-6 max-w-sm w-full text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Match Ended</h2>
            <p className="text-zinc-400 text-sm">
              {opponentLeftMessage}
            </p>
            <p className="text-zinc-500 text-xs mt-3">
              Returning to lobby...
            </p>
          </div>
        </div>
      )}

      {/* BLE Disconnected Overlay - skip in dev mode */}
      {!isConnected && !devMode && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-blue-600 rounded-xl p-6 max-w-sm w-full text-center">
            <Bluetooth className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Board Disconnected</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Your Granboard connection was lost. Reconnect to continue playing.
            </p>
            <button
              onClick={handleBLEReconnect}
              disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {bleStatus === 'connecting' || bleStatus === 'scanning' ? 'Connecting...' : 'Reconnect Board'}
            </button>
          </div>
        </div>
      )}

      {/* Header with Leave button and BLE status */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <button
          onClick={handleLeaveClick}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <X className="w-4 h-4" />
          Leave Match
        </button>

        <h1 className="text-lg font-bold text-white">CORK FOR FIRST</h1>

        {/* BLE Status/Connect */}
        {isConnected ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-600 rounded-lg">
            <Bluetooth className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-xs font-medium">Connected</span>
          </div>
        ) : (
          <button
            onClick={handleBLEConnect}
            disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <Bluetooth className="w-4 h-4" />
            {bleStatus === 'connecting' || bleStatus === 'scanning' ? 'Connecting...' : 'Connect Board'}
          </button>
        )}
      </div>

      {/* Opponent offline indicator in header area */}
      {!isOpponentOnline && disconnectCountdown === null && (
        <div className="bg-yellow-600/20 border-b border-yellow-600 px-3 py-1 flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3 text-yellow-500" />
          <span className="text-yellow-500 text-xs">{remotePlayerName} appears offline</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 relative">
        {/* Rules hint */}
        <p className="text-zinc-600 text-xs mb-3 text-center">Inner singles & bulls = face value | Others = 0</p>

        {/* Tie/Winner overlays */}
        {tieAlert && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-yellow-600 text-black px-6 py-3 rounded-xl animate-pulse">
            <p className="text-lg font-bold">TIE! Both rethrow!</p>
          </div>
        )}
        {winner && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-xl">
            <p className="text-lg font-bold">{winner === player1.id ? player1.name : player2.name} throws first!</p>
          </div>
        )}

        {/* Players side by side */}
        <div className="flex items-stretch justify-center gap-3 w-full max-w-3xl">
          {renderPlayer(player1, p1State, 1, isP1Local)}
          <div className="flex items-center">
            <div className="text-zinc-700 text-lg font-bold">VS</div>
          </div>
          {renderPlayer(player2, p2State, 2, !isP1Local)}
        </div>

        {/* Video status */}
        <p className="text-zinc-700 text-xs mt-3">Video: {connectionState}</p>

        {/* Dev Mode Throw Simulator */}
        {devMode && (
          <div className="mt-4 p-3 bg-orange-900/30 border border-orange-600 rounded-lg">
            <p className="text-orange-400 text-xs font-bold mb-2">DEV MODE - Throw Simulator</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[1, 5, 10, 15, 20].map(v => (
                <button
                  key={v}
                  onClick={() => simulateThrow('inner', v)}
                  className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded"
                >
                  {v}
                </button>
              ))}
              <button
                onClick={() => simulateThrow('bull')}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded"
              >
                BULL
              </button>
              <button
                onClick={() => simulateThrow('dblbull')}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded"
              >
                D-BULL
              </button>
              <button
                onClick={() => simulateThrow('miss')}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded"
              >
                MISS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
