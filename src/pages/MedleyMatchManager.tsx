import { useCallback, useEffect, useMemo, useState } from 'react';
import { CorkScreen } from '../components/CorkScreen';
import { createClient } from '../utils/supabase/client';
import { O1OnlineGameScreen } from './01OnlineGameScreen';
import { CROnlineGameScreen } from './CROnlineGameScreen';
import type { GameConfiguration } from '../types/game';

type PlayerInfo = {
  id: string;
  name: string;
  profilePic?: string;
  accentColor: string;
};

type LegType = '501' | '301' | 'cricket' | 'choice';
type PlayerId = 'p1' | 'p2';
type ChoiceMode = 'pick_game' | 'go_first';

interface MedleyMatchManagerProps {
  gameId: string;
  localPlayer: PlayerInfo;
  remotePlayer: PlayerInfo;
  isInitiator: boolean;
  gameConfig?: GameConfiguration | null;
  corkWinnerId?: string | null;
  onLeaveMatch?: () => void;
}

const normalizeLeg = (value: string | null | undefined): LegType => {
  const raw = (value || '').toString().trim().toLowerCase();
  if (raw === 'cr' || raw === 'cricket') return 'cricket';
  if (raw === 'ch' || raw === 'choice') return 'choice';
  if (raw === '301') return '301';
  return '501';
};

const toStorageLabel = (leg: LegType): string => {
  if (leg === 'cricket') return 'CR';
  if (leg === 'choice') return 'CH';
  return leg;
};

const normalizeLegs = (games?: string[] | null): LegType[] => {
  if (!games || games.length === 0) return ['501'];
  return games.map(normalizeLeg);
};

export function MedleyMatchManager({
  gameId,
  localPlayer,
  remotePlayer,
  isInitiator,
  gameConfig,
  corkWinnerId,
  onLeaveMatch,
}: MedleyMatchManagerProps) {
  const supabase = createClient();
  const p1 = isInitiator ? localPlayer : remotePlayer;
  const p2 = isInitiator ? remotePlayer : localPlayer;
  const p1Id = p1.id;
  const [liveConfig, setLiveConfig] = useState<GameConfiguration | null>(gameConfig || null);
  const [legs, setLegs] = useState<LegType[]>(() => normalizeLegs(gameConfig?.games));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchWinners, setMatchWinners] = useState<PlayerId[]>([]);
  const [gameKey, setGameKey] = useState(0);
  const [showCork, setShowCork] = useState(false);
  const [pendingLegIndex, setPendingLegIndex] = useState<number | null>(null);
  const [activeCorkWinnerId, setActiveCorkWinnerId] = useState<string | null>(corkWinnerId || null);
  const [currentStarter, setCurrentStarter] = useState<PlayerId>(() => {
    if (!corkWinnerId) return 'p1';
    return corkWinnerId === p1Id ? 'p1' : 'p2';
  });
  const [choiceMode, setChoiceMode] = useState<ChoiceMode | null>(null);
  const [choiceStarter, setChoiceStarter] = useState<PlayerId | null>(null);
  const [choiceChooser, setChoiceChooser] = useState<PlayerId | null>(null);
  const [matchWinner, setMatchWinner] = useState<PlayerId | null>(null);
  const [matchComplete, setMatchComplete] = useState(false);

  const toSide = useCallback((playerId: string): PlayerId => (playerId === p1Id ? 'p1' : 'p2'), [p1Id]);

  const gamesNeededToWin = useMemo(() => Math.max(1, Math.ceil(legs.length / 2)), [legs.length]);

  useEffect(() => {
    if (!corkWinnerId) return;
    setActiveCorkWinnerId(corkWinnerId);
    setCurrentStarter(corkWinnerId === p1Id ? 'p1' : 'p2');
  }, [corkWinnerId, p1Id]);

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel('active-game-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'companion',
          table: 'active_games',
          filter: `id=eq.${gameId}`,
        },
        (payload: any) => {
          const updatedConfig = payload.new?.game_config as GameConfiguration | null;
          if (!updatedConfig?.games) return;
          setLiveConfig(updatedConfig);
          setLegs(normalizeLegs(updatedConfig.games));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  useEffect(() => {
    const choice = liveConfig?.medleyChoice;
    if (!choice) return;
    if (choice.mode) setChoiceMode(choice.mode);
    if (choice.starter) setChoiceStarter(choice.starter);
    if (choice.chooser) setChoiceChooser(choice.chooser);
    if (choice.corkWinnerId) setActiveCorkWinnerId(choice.corkWinnerId);
  }, [liveConfig?.medleyChoice]);

  const currentLeg = legs[currentIndex] || '501';
  const corkWinnerSide = activeCorkWinnerId ? toSide(activeCorkWinnerId) : null;
  const localIsCorkWinner = activeCorkWinnerId === localPlayer.id;
  const localSide: PlayerId = localPlayer.id === p1Id ? 'p1' : 'p2';

  const availableChoiceGames = useMemo(() => {
    const prior = legs.slice(0, currentIndex).filter(leg => leg !== 'choice');
    const unique = Array.from(new Set(prior));
    return unique.length > 0 ? unique : ['501', 'cricket'];
  }, [currentIndex, legs]);

  const persistConfig = useCallback(async (updatedLegs: LegType[], choice?: GameConfiguration['medleyChoice']) => {
    const baseConfig: GameConfiguration = liveConfig || gameConfig || {
      legs: updatedLegs.length,
      games: updatedLegs.map(toStorageLabel),
      handicap: false,
      format: { inOut: null, bull: null },
    };
    const updatedConfig: GameConfiguration = {
      ...baseConfig,
      games: updatedLegs.map(toStorageLabel),
      medleyChoice: choice ?? baseConfig.medleyChoice,
    };
    setLiveConfig(updatedConfig);

    try {
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .update({ game_config: updatedConfig })
        .eq('id', gameId);
    } catch (err) {
      console.error('[MedleyMatchManager] Failed to sync choice:', err);
    }
  }, [gameConfig, gameId, liveConfig, supabase]);

  const handleChoiceModeSelect = useCallback((mode: ChoiceMode) => {
    if (!corkWinnerSide) return;
    const loserSide: PlayerId = corkWinnerSide === 'p1' ? 'p2' : 'p1';
    const starter = mode === 'pick_game' ? loserSide : corkWinnerSide;
    const chooser = mode === 'pick_game' ? corkWinnerSide : loserSide;

    setChoiceMode(mode);
    setChoiceStarter(starter);
    setChoiceChooser(chooser);

    void persistConfig(legs, {
      mode,
      starter,
      chooser,
      corkWinnerId: activeCorkWinnerId || undefined,
    });
  }, [activeCorkWinnerId, corkWinnerSide, legs, persistConfig]);

  const handleChoiceSelect = useCallback(async (selection: LegType) => {
    const updatedLegs = [...legs];
    updatedLegs[currentIndex] = selection;
    setLegs(updatedLegs);
    setGameKey(prev => prev + 1);
    if (choiceStarter) {
      setCurrentStarter(choiceStarter);
    }

    await persistConfig(updatedLegs, {
      mode: choiceMode || undefined,
      starter: choiceStarter || undefined,
      chooser: choiceChooser || undefined,
      corkWinnerId: activeCorkWinnerId || undefined,
      game: selection,
    });
  }, [activeCorkWinnerId, choiceChooser, choiceMode, choiceStarter, currentIndex, legs, persistConfig]);

  const advanceToNextLeg = useCallback((winner: PlayerId) => {
    const nextMatchWinners = [...matchWinners, winner];
    const p1Wins = nextMatchWinners.filter(w => w === 'p1').length;
    const p2Wins = nextMatchWinners.filter(w => w === 'p2').length;
    const nextIndex = currentIndex + 1;

    setMatchWinners(nextMatchWinners);

    if (p1Wins >= gamesNeededToWin || p2Wins >= gamesNeededToWin || nextIndex >= legs.length) {
      setMatchWinner(p1Wins >= gamesNeededToWin ? 'p1' : 'p2');
      setMatchComplete(true);
      return;
    }

    const needsCork = nextIndex === legs.length - 1 && p1Wins === p2Wins;
    if (needsCork) {
      setPendingLegIndex(nextIndex);
      setShowCork(true);
      return;
    }

    setCurrentIndex(nextIndex);
    setCurrentStarter(winner === 'p1' ? 'p2' : 'p1');
    setGameKey(prev => prev + 1);
  }, [currentIndex, gamesNeededToWin, legs.length, matchWinners]);

  const handleCorkComplete = useCallback((firstPlayerId: string) => {
    setActiveCorkWinnerId(firstPlayerId);
    const starter = toSide(firstPlayerId);
    setCurrentStarter(starter);
    setChoiceMode(null);
    setChoiceStarter(null);
    setChoiceChooser(null);
    if (pendingLegIndex !== null) {
      setCurrentIndex(pendingLegIndex);
      setPendingLegIndex(null);
      setShowCork(false);
      setGameKey(prev => prev + 1);
    }
  }, [pendingLegIndex, toSide]);

  if (showCork) {
    return (
      <CorkScreen
        player1={{ id: localPlayer.id, granboard_name: localPlayer.name, profilepic: localPlayer.profilePic, profilecolor: localPlayer.accentColor }}
        player2={{ id: remotePlayer.id, granboard_name: remotePlayer.name, profilepic: remotePlayer.profilePic, profilecolor: remotePlayer.accentColor }}
        gameId={gameId}
        visiblePlayerId={localPlayer.id}
        isInitiator={isInitiator}
        onCorkComplete={handleCorkComplete}
        onCancel={onLeaveMatch}
      />
    );
  }

  if (currentLeg === 'choice') {
    const loserSide: PlayerId | null = corkWinnerSide ? (corkWinnerSide === 'p1' ? 'p2' : 'p1') : null;
    const chooserSide: PlayerId | null = choiceMode
      ? (choiceMode === 'pick_game' ? corkWinnerSide : loserSide)
      : null;
    const localIsChooser = chooserSide === localSide;
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-black/70 p-8 text-center">
          <h2 className="text-white text-2xl mb-3" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            Final Leg Choice
          </h2>
          {!choiceMode ? (
            localIsCorkWinner ? (
              <>
                <p className="text-white/60 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  You won cork. Choose your advantage.
                </p>
                <div className="flex flex-col items-center justify-center gap-4">
                  <button
                    onClick={() => handleChoiceModeSelect('pick_game')}
                    className="w-full px-6 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 }}
                  >
                    Pick Game (loser goes first)
                  </button>
                  <button
                    onClick={() => handleChoiceModeSelect('go_first')}
                    className="w-full px-6 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 }}
                  >
                    Go First (loser picks game)
                  </button>
                </div>
              </>
            ) : (
              <p className="text-white/60" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                Waiting for opponent to choose their advantage...
              </p>
            )
          ) : localIsChooser ? (
            <>
              <p className="text-white/60 mb-6" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                Pick the final game (must be one already played).
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {availableChoiceGames.map(game => (
                  <button
                    key={game}
                    onClick={() => handleChoiceSelect(game)}
                    className="px-6 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 }}
                  >
                    {game === 'cricket' ? 'CR' : game}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-white/60" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Waiting for opponent to choose the final game...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full">
      {currentLeg === 'cricket' ? (
        <CROnlineGameScreen
          key={`cr-${gameKey}`}
          gameId={gameId}
          localPlayer={localPlayer}
          remotePlayer={remotePlayer}
          isInitiator={isInitiator}
          startingPlayer={currentStarter}
          onGameComplete={advanceToNextLeg}
          onLeaveMatch={onLeaveMatch || (() => {})}
        />
      ) : (
        <O1OnlineGameScreen
          key={`01-${gameKey}`}
          gameId={gameId}
          localPlayer={localPlayer}
          remotePlayer={remotePlayer}
          isInitiator={isInitiator}
          gameConfig={liveConfig || gameConfig || null}
          gameType={currentLeg}
          startingPlayer={currentStarter}
          onGameComplete={advanceToNextLeg}
          onLeaveMatch={onLeaveMatch}
        />
      )}

      {matchComplete && matchWinner && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div
              className="mb-4 text-white/70"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: '0.35em' }}
            >
              MATCH WINNER
            </div>
            <div
              className="text-6xl text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              {matchWinner === 'p1' ? p1.name : p2.name}
            </div>
            <button
              onClick={onLeaveMatch}
              className="mt-8 px-6 py-3 rounded-lg border border-white/30 text-white/80 hover:bg-white/10 transition"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              Exit to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedleyMatchManager;
