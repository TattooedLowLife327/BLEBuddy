import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '../utils/supabase/client';
import type { GameConfiguration } from '../types/game';
import { resolveProfilePicUrl } from '../utils/profile';
import { PlayerCardTop } from './PlayerCardTop';

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
    mprLetter?: string;
    pprLetter?: string;
    overallLetter?: string;
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

interface PlayerStats {
  granid: string | null;
  overallLetter: string | null;
  overallNumeric: number;
  mprLetter: string | null;
  mprNumeric: number;
  pprLetter: string | null;
  pprNumeric: number;
  gameCount: number;
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
  const [fetchedProfilePic, setFetchedProfilePic] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const supabase = createClient();
  
  // Refs for animation
  const flightIdRef = useRef(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const btn501Ref = useRef<HTMLButtonElement>(null);
  const btnCRRef = useRef<HTMLButtonElement>(null);
  const btnCHRef = useRef<HTMLButtonElement>(null);

  const hexToRgba = (color: string, alpha: number): string => {
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

        // Try player schema first and get profilepic
        const playerSchema = (supabase as any).schema('player');
        const { data: opponentProfile, error: profileError } = await playerSchema
          .from('player_profiles')
          .select('id, profilepic')
          .eq('id', player.player_id)
          .single();

        if (profileError || !opponentProfile) {
          // Must be youth player - try youth schema
          opponentIsYouth = true;
          const youthSchema = (supabase as any).schema('youth');
          const { data: youthProfile } = await youthSchema
            .from('youth_profiles')
            .select('id, profilepic')
            .eq('id', player.player_id)
            .single();

          if (youthProfile?.profilepic) {
            setFetchedProfilePic(resolveProfilePicUrl(youthProfile.profilepic));
          }
        } else if (opponentProfile?.profilepic) {
          setFetchedProfilePic(resolveProfilePicUrl(opponentProfile.profilepic));
        }

        // Fetch opponent's solo stats
        const statsSchema = opponentIsYouth
          ? (supabase as any).schema('youth')
          : (supabase as any).schema('player');

        const { data: statsData, error: statsError } = await statsSchema
          .from(opponentIsYouth ? 'youth_stats' : 'player_stats')
          .select('granid, overall_letter, overall_numeric, mpr_letter, mpr_numeric, ppr_letter, ppr_numeric, online_game_count, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
          .eq('id', player.player_id)
          .single();

        if (statsError) {
          console.error('Error fetching stats:', statsError);
          // Use provided data as fallback (including letter ratings from props)
          setSoloStats({
            granid: null,
            overallLetter: player.overallLetter || null,
            overallNumeric: player.overallNumeric,
            mprLetter: player.mprLetter || null,
            mprNumeric: player.mprNumeric,
            pprLetter: player.pprLetter || null,
            pprNumeric: player.pprNumeric,
            gameCount: 0,
            soloGamesPlayed: 0,
            soloWins: 0,
            soloWinRate: 0,
            soloHighestCheckout: 0,
          });
        } else {
          setSoloStats({
            granid: statsData.granid || null,
            overallLetter: statsData.overall_letter || null,
            overallNumeric: statsData.overall_numeric || 0,
            mprLetter: statsData.mpr_letter || null,
            mprNumeric: statsData.mpr_numeric || 0,
            pprLetter: statsData.ppr_letter || null,
            pprNumeric: statsData.ppr_numeric || 0,
            gameCount: statsData.online_game_count || 0,
            soloGamesPlayed: statsData.solo_games_played || 0,
            soloWins: statsData.solo_wins || 0,
            soloWinRate: statsData.solo_win_rate || 0,
            soloHighestCheckout: statsData.solo_highest_checkout || 0,
          });
        }

        // Fetch friend count
        try {
          const { count } = await (supabase as any)
            .schema('player')
            .from('friends')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'accepted')
            .or(`player_id.eq.${player.player_id},friend_id.eq.${player.player_id}`);
          setFriendCount(count || 0);
        } catch {
          setFriendCount(0);
        }

        // If opponent is a doubles team, fetch partner stats and calculate team averages
        if (player.isDoublesTeam && player.partnerId) {
          console.log('Fetching partner stats for:', player.partnerId);

          // Determine if partner is youth
          let partnerIsYouth = opponentIsYouth; // Assume same schema for now

          const partnerStatsSchema = partnerIsYouth
            ? (supabase as any).schema('youth')
            : (supabase as any).schema('player');

          const { data: partnerStatsData, error: partnerStatsError } = await partnerStatsSchema
            .from(partnerIsYouth ? 'youth_stats' : 'player_stats')
            .select('granid, overall_letter, overall_numeric, mpr_letter, mpr_numeric, ppr_letter, ppr_numeric, online_game_count, solo_games_played, solo_wins, solo_win_rate, solo_highest_checkout')
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
        // Use provided data as fallback (including letter ratings from props)
        setSoloStats({
          granid: null,
          overallLetter: player.overallLetter || null,
          overallNumeric: player.overallNumeric,
          mprLetter: player.mprLetter || null,
          mprNumeric: player.mprNumeric,
          pprLetter: player.pprLetter || null,
          pprNumeric: player.pprNumeric,
          gameCount: 0,
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
    setShowConfirmModal(true);
  };

  const confirmAndSendRequest = () => {
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
    setShowConfirmModal(false);
    onStartGame(config);
  };

  // Format descriptions for display
  const getFormatDescription = () => {
    const parts: string[] = [];
    if (do_) parts.push('Double Out');
    else if (mo) parts.push('Master Out');
    else if (mimo) parts.push('Master In/Master Out');
    else if (dido) parts.push('Double In/Double Out');
    if (full) parts.push('Full Bull (50pts)');
    else if (split) parts.push('Split Bull (25/50)');
    return parts.join(' | ');
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

  // Check if at least one game is selected (required to start)
  const hasGameSelected = games.some(g => g !== '');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
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
        className="rounded-lg border bg-zinc-900/90 overflow-hidden flex flex-col origin-center"
        style={{
          width: '700px',
          maxHeight: '550px',
          borderColor: player.accentColor,
          boxShadow: `0 0 12px ${hexToRgba(player.accentColor, 0.4)}`,
          transform: `scale(${modalScale})`,
        }}
      >
        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Player card top (PlayerCardReadOnly style from legitllogb) */}
          <div className="w-1/3 relative overflow-hidden min-w-0">
            <PlayerCardTop
              variant="panel"
              llogbBadge
              data={{
                granboardName: player.granboardName,
                profilePic: player.profilePic,
                accentColor: player.accentColor,
                granid: soloStats?.granid ?? null,
                friendCount,
                onlineGameCount: soloStats && 'gameCount' in soloStats ? soloStats.gameCount : 0,
                pprLetter: displayStats && 'pprLetter' in displayStats ? displayStats.pprLetter ?? null : null,
                pprNumeric: displayStats?.pprNumeric ?? 0,
                overallLetter: displayStats && 'overallLetter' in displayStats ? displayStats.overallLetter ?? null : null,
                overallNumeric: displayStats?.overallNumeric ?? 0,
                mprLetter: displayStats && 'mprLetter' in displayStats ? displayStats.mprLetter ?? null : null,
                mprNumeric: displayStats?.mprNumeric ?? 0,
                partnerName: player.partnerName ?? null,
              }}
              loading={loading}
              resolvedProfilePic={fetchedProfilePic}
            />
          </div>

          {/* Right Side - Game Setup (format section) */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col">
            {/* Top row: Handicap toggle + Close button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
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
                      borderColor: games[idx] ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.15)',
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
                  className={`rounded-lg px-6 py-3 text-lg border transition-colors ${
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
                  className={`rounded-lg px-6 py-3 text-lg border transition-colors ${
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
                  className={`rounded-lg px-6 py-3 text-lg border transition-colors ${
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
                        borderColor: do_ ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)',
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
                        borderColor: mo ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)',
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
                        borderColor: mimo ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)',
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
                        borderColor: dido ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)',
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
                        borderColor: full ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)',
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
                        borderColor: split ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)',
                        backgroundColor: split ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)',
                        color: split ? 'white' : 'rgb(212,212,216)',
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontWeight: 'bold',
                      }}
                    >
                      Split
                    </button>
                  </div>
                  {/* Format description */}
                  {(do_ || mo || mimo || dido || full || split) && (
                    <div className="text-center text-xs text-zinc-400 mt-1">
                      {getFormatDescription()}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Send Request Button */}
            <button
              onClick={handleStartGame}
              disabled={!hasGameSelected}
              className={`w-full py-3 rounded-lg text-white text-sm transition-all ${
                hasGameSelected ? 'hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                backgroundColor: hasGameSelected ? player.accentColor : '#555',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 'bold',
                boxShadow: hasGameSelected ? `0 0 20px ${hexToRgba(player.accentColor, 0.5)}` : 'none',
              }}
            >
              {hasGameSelected ? 'Send Request' : 'Select a Game'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 rounded-lg border p-6 max-w-sm w-full"
              style={{ borderColor: player.accentColor }}
            >
              <h3 className="text-lg font-bold text-white mb-4 text-center">Confirm Game Request</h3>
              <div className="text-sm text-zinc-300 mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Opponent:</span>
                  <span className="font-medium">{player.granboardName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Legs:</span>
                  <span className="font-medium">{legs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Games:</span>
                  <span className="font-medium">{games.filter(g => g).join(', ')}</span>
                </div>
                {getFormatDescription() && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Format:</span>
                    <span className="font-medium text-right">{getFormatDescription()}</span>
                  </div>
                )}
                {handicap && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Handicap:</span>
                    <span className="font-medium">Enabled</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAndSendRequest}
                  className="flex-1 py-2 rounded-lg text-white font-bold transition-colors"
                  style={{ backgroundColor: player.accentColor }}
                >
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
