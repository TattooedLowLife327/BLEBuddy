import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { createClient } from '../utils/supabase/client';

// Convert hex color to hue value (0-360)
function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return Math.round(h * 360);
}

interface PlayerGameSetupProps {
  player: {
    player_id: string;
    granboardName: string;
    profilePic?: string;
    mprNumeric: number;
    pprNumeric: number;
    overallNumeric: number;
    accentColor: string;
    isDoublesTeam: boolean;
    partnerId?: string;
    partnerName?: string;
  };
  onClose: () => void;
  onStartGame: (gameConfig: GameConfiguration) => void;
  isDoublesTeam?: boolean;
  partnerName?: string;
  userId: string;
  isYouthPlayer: boolean;
}

interface GameConfiguration {
  legs: number;
  games: string[];
  handicap: boolean;
  format: {
    inOut: 'do' | 'mo' | 'mimo' | 'dido' | null;
    bull: 'full' | 'split' | null;
  };
}

interface PlayerStats {
  overallNumeric: number;
  mprNumeric: number;
  pprNumeric: number;
  soloGamesPlayed: number;
  soloWins: number;
  soloWinRate: number;
  soloHighestCheckout: number;
}

interface DoublesStats {
  overallNumeric: number;
  mprNumeric: number;
  pprNumeric: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  highestCheckout: number;
}

interface FlightAnimation {
  id: number;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function PlayerGameSetup({ 
  player, 
  onClose, 
  onStartGame, 
  isDoublesTeam = false, 
  partnerName,
  userId,
  isYouthPlayer,
}: PlayerGameSetupProps) {
  const [legs, setLegs] = useState<number>(1);
  const [games, setGames] = useState<string[]>(['']);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);
  const [handicap, setHandicap] = useState(false);
  
  // Format states
  const [do_, setDo_] = useState(false);
  const [mo, setMo] = useState(false);
  const [mimo, setMimo] = useState(false);
  const [dido, setDido] = useState(false);
  const [full, setFull] = useState(false);
  const [split, setSplit] = useState(false);
  
  const [soloStats, setSoloStats] = useState<PlayerStats | null>(null);
  const [doublesStats, setDoublesStats] = useState<DoublesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [flight, setFlight] = useState<FlightAnimation | null>(null);
  const [modalScale, setModalScale] = useState(1);

  const supabase = createClient();
  
  // Refs for animation
  const flightIdRef = useRef(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const btn501Ref = useRef<HTMLButtonElement>(null);
  const btnCRRef = useRef<HTMLButtonElement>(null);
  const btnCHRef = useRef<HTMLButtonElement>(null);

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Calculate hue for toggle filter (base SVG is purple ~270 hue)
  const profileHue = useMemo(() => hexToHue(player.accentColor), [player.accentColor]);

  // Calculate modal scale based on viewport
  useEffect(() => {
    const calculateScale = () => {
      // Check if we're in portrait mode (CSS rotates to landscape)
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;

      // When in portrait, CSS rotates content so swap width/height for calculations
      const viewWidth = isPortrait ? window.innerHeight : window.innerWidth;
      const viewHeight = isPortrait ? window.innerWidth : window.innerHeight;

      const widthScale = (viewWidth - 48) / 700; // base modal width ~700px
      const heightScale = (viewHeight - 48) / 550; // base modal height ~550px
      setModalScale(Math.min(widthScale, heightScale, 1.2)); // Cap at 1.2x
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    const orientationQuery = window.matchMedia('(orientation: portrait)');
    orientationQuery.addEventListener('change', calculateScale);
    return () => {
      window.removeEventListener('resize', calculateScale);
      orientationQuery.removeEventListener('change', calculateScale);
    };
  }, []);

  // Update games array when legs change
  useEffect(() => {
    setGames(Array.from({ length: legs }, () => ''));
    setLastAddedIndex(null);
  }, [legs]);

  // Fetch player stats on mount
  useEffect(() => {
    async function fetchPlayerStats() {
      try {
        console.log('Fetching stats for player:', player.player_id);

        // Determine if opponent is youth (we need to check their profile)
        let opponentIsYouth = false;
        
        // Try player schema first
        const { data: opponentProfile, error: profileError } = await supabase
          .from('player_profiles')
          .select('id')
          .eq('id', player.player_id)
          .single();

        if (profileError || !opponentProfile) {
          // Must be youth player
          opponentIsYouth = true;
        }

        // Fetch opponent's solo stats
        const statsQuery = opponentIsYouth
          ? supabase.schema('youth').from('youth_stats')
          : supabase.from('player_stats');

        const { data: statsData, error: statsError } = await statsQuery
          .select('overall_numeric, mpr_numeric, ppr_numeric, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
          .eq('id', player.player_id)
          .single();

        if (statsError) {
          console.error('Error fetching stats:', statsError);
          // Use provided data as fallback
          setSoloStats({
            overallNumeric: player.overallNumeric,
            mprNumeric: player.mprNumeric,
            pprNumeric: player.pprNumeric,
            soloGamesPlayed: 0,
            soloWins: 0,
            soloWinRate: 0,
            soloHighestCheckout: 0,
          });
        } else {
          setSoloStats({
            overallNumeric: statsData.overall_numeric || 0,
            mprNumeric: statsData.mpr_numeric || 0,
            pprNumeric: statsData.ppr_numeric || 0,
            soloGamesPlayed: statsData.solo_games_played || 0,
            soloWins: statsData.solo_wins || 0,
            soloWinRate: statsData.solo_win_rate || 0,
            soloHighestCheckout: statsData.solo_highest_checkout || 0,
          });
        }

        // If opponent is a doubles team, fetch partner stats and calculate team averages
        if (player.isDoublesTeam && player.partnerId) {
          console.log('Fetching partner stats for:', player.partnerId);

          // Determine if partner is youth
          let partnerIsYouth = opponentIsYouth; // Assume same schema for now

          const partnerStatsQuery = partnerIsYouth
            ? supabase.schema('youth').from('youth_stats')
            : supabase.from('player_stats');

          const { data: partnerStatsData, error: partnerStatsError } = await partnerStatsQuery
            .select('overall_numeric, mpr_numeric, ppr_numeric, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
            .eq('id', player.partnerId)
            .single();

          if (!partnerStatsError && partnerStatsData && statsData) {
            // Calculate team averages by averaging both players' individual stats
            const teamOverall = (statsData.overall_numeric + partnerStatsData.overall_numeric) / 2;
            const teamMpr = (statsData.mpr_numeric + partnerStatsData.mpr_numeric) / 2;
            const teamPpr = (statsData.ppr_numeric + partnerStatsData.ppr_numeric) / 2;
            const teamGamesPlayed = statsData.solo_games_played + partnerStatsData.solo_games_played;
            const teamWins = statsData.solo_wins + partnerStatsData.solo_wins;
            const teamWinRate = teamGamesPlayed > 0 ? (teamWins / teamGamesPlayed) * 100 : 0;
            const teamHighestCheckout = Math.max(statsData.solo_highest_checkout, partnerStatsData.solo_highest_checkout);

            setDoublesStats({
              overallNumeric: teamOverall,
              mprNumeric: teamMpr,
              pprNumeric: teamPpr,
              gamesPlayed: teamGamesPlayed,
              wins: teamWins,
              winRate: teamWinRate,
              highestCheckout: teamHighestCheckout,
            });
          } else {
            console.error('Error fetching partner stats:', partnerStatsError);
            // Use opponent's stats as fallback
            setDoublesStats({
              overallNumeric: statsData?.overall_numeric || 0,
              mprNumeric: statsData?.mpr_numeric || 0,
              pprNumeric: statsData?.ppr_numeric || 0,
              gamesPlayed: statsData?.solo_games_played || 0,
              wins: statsData?.solo_wins || 0,
              winRate: statsData?.solo_win_rate || 0,
              highestCheckout: statsData?.solo_highest_checkout || 0,
            });
          }
        }
      } catch (err) {
        console.error('Error in fetchPlayerStats:', err);
        // Use provided data as fallback
        setSoloStats({
          overallNumeric: player.overallNumeric,
          mprNumeric: player.mprNumeric,
          pprNumeric: player.pprNumeric,
          soloGamesPlayed: 0,
          soloWins: 0,
          soloWinRate: 0,
          soloHighestCheckout: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchPlayerStats();
  }, [player.player_id, player.isDoublesTeam, player.partnerId]);

  const handleStartGame = () => {
    // Determine format
    let inOut: 'do' | 'mo' | 'mimo' | 'dido' | null = null;
    if (do_) inOut = 'do';
    else if (mo) inOut = 'mo';
    else if (mimo) inOut = 'mimo';
    else if (dido) inOut = 'dido';

    let bull: 'full' | 'split' | null = null;
    if (full) bull = 'full';
    else if (split) bull = 'split';

    const config: GameConfiguration = {
      legs,
      games,
      handicap,
      format: {
        inOut,
        bull,
      },
    };
    onStartGame(config);
  };

  const addGame = (gameLabel: string) => {
    setGames(prev => {
      const i = prev.findIndex(x => !x);
      if (i === -1) return prev;
      const next = [...prev];
      next[i] = gameLabel;
      setLastAddedIndex(i);
      return next;
    });
  };

  // Determine which stats to display
  const displayStats = player.isDoublesTeam ? doublesStats : soloStats;

  // Game slot logic
  const nextIndex = games.findIndex(g => !g);
  const allFilled = nextIndex === -1;
  const lastIndex = legs - 1;
  const isPickingLast = nextIndex === lastIndex;
  const has01Game = games.some(g => g === '501'); // Format options only for 01 games

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Flying animation overlay */}
      <AnimatePresence>
        {flight && (
          <motion.div
            key={flight.id}
            className="fixed pointer-events-none z-[60] text-sm font-semibold text-white bg-primary/80 px-3 py-1 rounded-lg"
            initial={{ x: flight.from.x, y: flight.from.y, scale: 0.8, opacity: 0 }}
            animate={{ x: flight.to.x, y: flight.to.y, scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.4 }}
            onAnimationComplete={() => setFlight(null)}
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {flight.label}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="rounded-2xl border backdrop-blur-xl bg-zinc-900/25 overflow-hidden flex flex-col origin-center"
        style={{
          width: '700px',
          maxHeight: '550px',
          borderColor: hexToRgba(player.accentColor, 0.4),
          boxShadow: `0 0 40px ${hexToRgba(player.accentColor, 0.3)}, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
          transform: `scale(${modalScale})`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: player.accentColor + '40' }}>
          <div className="flex items-center gap-3">
            <Avatar
              className="w-12 h-12 border-2"
              style={{
                borderColor: player.accentColor,
                boxShadow: `0 0 15px ${hexToRgba(player.accentColor, 0.6)}`,
              }}
            >
              <AvatarImage src={player.profilePic} />
              <AvatarFallback className="bg-white/10 text-white text-lg">
                {player.granboardName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2
                className="text-xl text-white"
                style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', color: player.accentColor }}
              >
                {player.granboardName}
              </h2>
              {player.isDoublesTeam && player.partnerName && (
                <p className="text-gray-400 text-xs" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  + {player.partnerName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Handicap Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                Handicap
              </span>
              <button
                type="button"
                onClick={() => setHandicap(!handicap)}
                className="relative inline-flex items-center justify-center transition-all"
                style={{
                  width: '56px',
                  height: '27px',
                }}
              >
                {/* Base SVG */}
                <img
                  src={handicap ? '/assets/ontogglebase.svg' : '/assets/offtogglebase.svg'}
                  alt={handicap ? 'On' : 'Off'}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity"
                  style={
                    handicap
                      ? {
                          filter: `hue-rotate(${profileHue - 270}deg) saturate(1.2) brightness(1.1)`,
                          width: '47px',
                          height: '17px',
                        }
                      : {
                          width: '56px',
                          height: '17px',
                        }
                  }
                />
                {/* Knob SVG */}
                <img
                  src={handicap ? '/assets/ontoggleknob.svg' : '/assets/offtoggleknob.svg'}
                  alt="Toggle knob"
                  className="absolute transition-all duration-200"
                  style={{
                    left: handicap ? '15px' : '-7px',
                    top: '55%',
                    transform: 'translateY(-50%)',
                    width: '26px',
                    height: '27px',
                  }}
                />
              </button>
            </div>
            <button
              onClick={onClose}
              className="hover:opacity-80 transition-opacity"
              aria-label="Close"
            >
              <img src="/icons/closebutton.svg" alt="Close" className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Stats */}
          <div className="w-1/3 p-4 border-r overflow-y-auto" style={{ borderColor: player.accentColor + '40' }}>
            <h3
              className="text-sm mb-3 text-white"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
            >
              {player.isDoublesTeam ? 'Team Stats' : 'Player Stats'}
            </h3>

            {loading ? (
              <div className="text-gray-400 text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                Loading stats...
              </div>
            ) : displayStats ? (
              <div>
                {/* Averages Section */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Overall Average</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {displayStats.overallNumeric.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>01 Average</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {displayStats.mprNumeric.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Cricket Average</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {displayStats.pprNumeric.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <Separator className="my-3" style={{ backgroundColor: player.accentColor + '40' }} />

                {/* Other Stats Section */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Games Played</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {'gamesPlayed' in displayStats ? displayStats.gamesPlayed : displayStats.soloGamesPlayed}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Wins</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {'wins' in displayStats ? displayStats.wins : displayStats.soloWins}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Win Rate</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {'winRate' in displayStats ? displayStats.winRate.toFixed(1) : displayStats.soloWinRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Highest Checkout</span>
                    <span className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>
                      {'highestCheckout' in displayStats ? displayStats.highestCheckout : displayStats.soloHighestCheckout}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                No stats available
              </div>
            )}
          </div>

          {/* Right Side - Game Setup */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Legs Selection - only 3 or 5 legs, 1 leg is default (no selection) */}
            <div className="mb-4">
              <div className="flex gap-2 justify-center">
                {[3, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLegs(legs === num ? 1 : num)}
                    className="py-2 px-4 rounded-lg border transition-all text-sm"
                    style={{
                      borderColor: legs === num ? player.accentColor : '#444',
                      backgroundColor: legs === num ? hexToRgba(player.accentColor, 0.2) : 'transparent',
                      color: legs === num ? player.accentColor : '#fff',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontWeight: 'bold',
                      boxShadow: legs === num ? `0 0 15px ${hexToRgba(player.accentColor, 0.4)}` : 'none',
                    }}
                  >
                    {num} Legs
                  </button>
                ))}
              </div>
            </div>

            {/* Game Slots - only show boxes when 3 or 5 legs selected */}
            <div className="space-y-2 mb-4">
              {/* Game slot boxes - only for multi-leg */}
              {legs > 1 && (
              <div className="flex items-center justify-center gap-2 max-w-[300px] mx-auto">
                {Array.from({ length: legs }).map((_, idx) => (
                  <motion.div
                    key={idx}
                    className={`flex-1 h-10 rounded-lg border text-center flex items-center justify-center select-none ${
                      games[idx]
                        ? 'cursor-pointer'
                        : 'opacity-80'
                    }`}
                    ref={el => {
                      if (el) slotRefs.current[idx] = el;
                    }}
                    initial={false}
                    animate={
                      games[idx]
                        ? {
                            scale: idx === lastAddedIndex ? 1.03 : 1,
                            boxShadow: idx === lastAddedIndex ? '0 0 0 0 rgba(0,0,0,0)' : undefined,
                          }
                        : { scale: 1 }
                    }
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    title={games[idx] ? 'Click to remove' : ''}
                    onClick={() => {
                      if (!games[idx]) return;
                      setGames(prev => {
                        const next = [...prev];
                        next[idx] = '';
                        return next;
                      });
                      setLastAddedIndex(null);
                    }}
                    style={{
                      borderColor: games[idx] ? `${player.accentColor}99` : 'rgba(255,255,255,0.15)',
                      backgroundColor: games[idx] ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.4)',
                    }}
                    whileHover={games[idx] ? {
                      borderColor: 'rgba(239, 68, 68, 0.6)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    } : {}}
                  >
                    <AnimatePresence mode="popLayout">
                      {games[idx] && (
                        <motion.span
                          key={`${idx}-${games[idx]}`}
                          initial={{ y: -10, opacity: 0, scale: 0.98 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          exit={{ y: 8, opacity: 0, scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                          className="text-sm tracking-wide text-white"
                          style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                        >
                          {games[idx]}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
              )}

              {/* Game picker buttons */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  ref={btn501Ref}
                  onClick={() => {
                    if (allFilled) return;
                    const i = games.findIndex(x => !x);
                    const src = btn501Ref.current;
                    const dst = slotRefs.current[i];
                    if (src && dst) {
                      const s = src.getBoundingClientRect();
                      const d = dst.getBoundingClientRect();
                      const from = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
                      const to = { x: d.left + d.width / 2, y: d.top + d.height / 2 };
                      setFlight({ id: ++flightIdRef.current, label: '501', from, to });
                    }
                    addGame('501');
                  }}
                  disabled={allFilled}
                  className={`rounded-lg px-4 py-2 border transition-colors ${
                    allFilled
                      ? 'border-white/15 bg-zinc-900/40 text-zinc-500 opacity-60 cursor-not-allowed'
                      : 'border-white/15 bg-zinc-900/40 hover:border-primary/60 hover:bg-primary/10 text-white'
                  }`}
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                >
                  501
                </button>
                <button
                  type="button"
                  ref={btnCRRef}
                  onClick={() => {
                    if (allFilled) return;
                    const i = games.findIndex(x => !x);
                    const src = btnCRRef.current;
                    const dst = slotRefs.current[i];
                    if (src && dst) {
                      const s = src.getBoundingClientRect();
                      const d = dst.getBoundingClientRect();
                      const from = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
                      const to = { x: d.left + d.width / 2, y: d.top + d.height / 2 };
                      setFlight({ id: ++flightIdRef.current, label: 'CR', from, to });
                    }
                    addGame('CR');
                  }}
                  disabled={allFilled}
                  className={`rounded-lg px-4 py-2 border transition-colors ${
                    allFilled
                      ? 'border-white/15 bg-zinc-900/40 text-zinc-500 opacity-60 cursor-not-allowed'
                      : 'border-white/15 bg-zinc-900/40 hover:border-primary/60 hover:bg-primary/10 text-white'
                  }`}
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                >
                  CR
                </button>
                <button
                  type="button"
                  ref={btnCHRef}
                  onClick={() => {
                    if (legs <= 1 || !isPickingLast || allFilled) return;
                    const i = games.findIndex(x => !x);
                    const src = btnCHRef.current;
                    const dst = slotRefs.current[i];
                    if (src && dst) {
                      const s = src.getBoundingClientRect();
                      const d = dst.getBoundingClientRect();
                      const from = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
                      const to = { x: d.left + d.width / 2, y: d.top + d.height / 2 };
                      setFlight({ id: ++flightIdRef.current, label: 'CH', from, to });
                    }
                    addGame('CH');
                  }}
                  disabled={legs <= 1 || !isPickingLast || allFilled}
                  title={legs <= 1 ? 'Choice only available for 3 or 5 leg matches' : !isPickingLast ? 'Choice unlocks for the last leg' : ''}
                  className={`rounded-lg px-4 py-2 border transition-colors ${
                    legs <= 1 || !isPickingLast || allFilled
                      ? 'border-white/15 bg-zinc-900/40 text-zinc-500 opacity-40 cursor-not-allowed'
                      : 'border-white/15 bg-zinc-900/40 hover:border-primary/60 hover:bg-primary/10 text-white'
                  }`}
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}
                >
                  CH
                </button>
              </div>
            </div>

            {/* Format chips: Do Mo MiMo DiDo | Full Split - slides in when 01 game selected */}
            <AnimatePresence>
              {has01Game && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden mb-4"
                >
                  <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-1">
                    <button
                      type="button"
                      onClick={() => setDo_(prev => { const next = !prev; if (next) { setMo(false); setMimo(false); setDido(false); } return next; })}
                      className="rounded-lg px-3 py-1.5 text-xs border transition-colors"
                      style={{
                        borderColor: do_ ? `${player.accentColor}99` : 'rgba(255,255,255,0.1)',
                        backgroundColor: do_ ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: do_ ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      Do
                    </button>
                    <button
                      type="button"
                      onClick={() => setMo(prev => { const next = !prev; if (next) { setDo_(false); setMimo(false); setDido(false); } return next; })}
                      className="rounded-lg px-3 py-1.5 text-xs border transition-colors"
                      style={{
                        borderColor: mo ? `${player.accentColor}99` : 'rgba(255,255,255,0.1)',
                        backgroundColor: mo ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: mo ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      Mo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMimo(prev => { const next = !prev; if (next) { setDo_(false); setMo(false); setDido(false); } return next; })}
                      className="rounded-lg px-3 py-1.5 text-xs border transition-colors"
                      style={{
                        borderColor: mimo ? `${player.accentColor}99` : 'rgba(255,255,255,0.1)',
                        backgroundColor: mimo ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: mimo ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      MiMo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDido(prev => { const next = !prev; if (next) { setMo(false); setMimo(false); setDo_(false); } return next; })}
                      className="rounded-lg px-3 py-1.5 text-xs border transition-colors"
                      style={{
                        borderColor: dido ? `${player.accentColor}99` : 'rgba(255,255,255,0.1)',
                        backgroundColor: dido ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: dido ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      DiDo
                    </button>
                    <div className="w-2" />
                    <button
                      type="button"
                      onClick={() => setFull(prev => { const next = !prev; if (next) setSplit(false); return next; })}
                      className="rounded-lg px-3 py-1.5 text-xs border transition-colors"
                      style={{
                        borderColor: full ? `${player.accentColor}99` : 'rgba(255,255,255,0.1)',
                        backgroundColor: full ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: full ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      Full
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplit(prev => { const next = !prev; if (next) setFull(false); return next; })}
                      className="rounded-lg px-3 py-1.5 text-xs border transition-colors"
                      style={{
                        borderColor: split ? `${player.accentColor}99` : 'rgba(255,255,255,0.1)',
                        backgroundColor: split ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: split ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      Split
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start Game Button */}
            <button
              onClick={handleStartGame}
              className="w-full py-3 rounded-lg text-white text-sm transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: player.accentColor,
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 'bold',
                boxShadow: `0 0 20px ${hexToRgba(player.accentColor, 0.5)}`,
              }}
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
