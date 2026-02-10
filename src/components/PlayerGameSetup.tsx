import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import type { GameConfiguration } from '../types/game';
import { resolveProfilePicUrl, resolveSkinUrl } from '../utils/profile';
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

interface FlightAnimation {
  id: number;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
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

export function PlayerGameSetup({ 
  player, 
  onClose, 
  onStartGame, 
  isDoublesTeam: _isDoublesTeam = false, 
  partnerName: _partnerName,
  userId: _userId,
  isYouthPlayer: _isYouthPlayer,
}: PlayerGameSetupProps) {
  const [legs, setLegs] = useState<number>(3);
  const [games, setGames] = useState<string[]>(['', '', '']);
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
  const [glowGame, setGlowGame] = useState<'501' | 'CR' | 'CH' | null>(null);
  const [modalScale, setModalScale] = useState(1);
  const [fetchedProfilePic, setFetchedProfilePic] = useState<string | null>(null);
  const [fetchedSkin, setFetchedSkin] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const supabase = createClient();
  const flightIdRef = useRef(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const btn501Ref = useRef<HTMLButtonElement>(null);
  const btnCRRef = useRef<HTMLButtonElement>(null);
  const btnCHRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (glowGame === null) return;
    const t = setTimeout(() => setGlowGame(null), 500);
    return () => clearTimeout(t);
  }, [glowGame]);

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
          .select('id, profilepic, skin')
          .eq('id', player.player_id)
          .single();

        if (profileError || !opponentProfile) {
          // Must be youth player - try youth schema
          opponentIsYouth = true;
          const youthSchema = (supabase as any).schema('youth');
          const { data: youthProfile } = await youthSchema
            .from('youth_profiles')
            .select('id, profilepic, skin')
            .eq('id', player.player_id)
            .single();

          // Always set fetched profile pic to resolved URL if available, prioritizing youthProfile
          const youthPicUrl = youthProfile?.profilepic ? resolveProfilePicUrl(youthProfile.profilepic) : null;
          const oppPicUrl = opponentProfile?.profilepic ? resolveProfilePicUrl(opponentProfile.profilepic) : null;

          if (youthPicUrl) {
            setFetchedProfilePic(youthPicUrl || null);
          } else if (oppPicUrl) {
            setFetchedProfilePic(oppPicUrl || null);
          } else {
            setFetchedProfilePic(null);
          }

          const skinUrl = resolveSkinUrl(youthProfile?.skin ?? opponentProfile?.skin ?? null);
          setFetchedSkin(skinUrl ?? null);
        } else {
          setFetchedProfilePic(opponentProfile?.profilepic ? (resolveProfilePicUrl(opponentProfile.profilepic) ?? null) : null);
          setFetchedSkin(resolveSkinUrl(opponentProfile?.skin ?? null) ?? null);
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
          const partnerIsYouth = opponentIsYouth; // Assume same schema for now

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
  const lastIndex = legs - 1;
  const isPickingLast = nextIndex === lastIndex;
  const has01Game = games.some(g => g === '501'); // Format options only for 01 games

  // Send enabled only when all slots filled and (if 01 in selection) 01 + bull format chosen
  const allSlotsFilled = games.length === legs && games.every(g => g && g.length > 0);
  const has01Format = do_ || mo || mimo || dido;
  const hasBullFormat = full || split;
  const formatComplete = !has01Game || (has01Format && hasBullFormat);
  const canSend = allSlotsFilled && formatComplete;

  // Which game-type buttons get profile border (when that type is in the slots)
  const gamesInclude501 = games.some(g => g === '501');
  const gamesIncludeCR = games.some(g => g === 'CR');
  const gamesIncludeCH = games.some(g => g === 'CH');
  const chDisabled = legs <= 1 || !isPickingLast;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Flying animation: only when filling medley legs (legs > 1) */}
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
        className="rounded-xl border-[3px] bg-zinc-900/95 overflow-hidden flex flex-col origin-center"
        style={{
          width: '700px',
          maxHeight: '550px',
          borderColor: player.accentColor,
          boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 14px ${hexToRgba(player.accentColor, 0.35)}`,
          transform: `scale(${modalScale})`,
        }}
      >
        {/* Content - no separate header bar; close is in right panel */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Side - Player card (same border as PFP; no radius on top-right/bottom-right) */}
          <div className="w-1/3 relative overflow-hidden min-w-0 rounded-l-xl">
            <PlayerCardTop
              variant="panel"
              llogbBadge
              data={{
                granboardName: player.granboardName,
                profilePic: player.profilePic,
                accentColor: player.accentColor,
                skin: fetchedSkin ?? undefined,
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
              resolvedProfilePic={fetchedProfilePic ?? resolveProfilePicUrl(player.profilePic ?? undefined)}
            />
          </div>

          {/* Right Side - Game Setup */}
          <div className="flex-1 flex flex-col min-h-0 p-4 pb-2 relative">
            {/* 1. Top row: Handicap (left) | FORMAT (center bold) | X (right) */}
            <div className="relative flex items-center justify-between shrink-0 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Handicap</span>
                <button
                  type="button"
                  onClick={() => setHandicap(!handicap)}
                  className="relative inline-flex items-center justify-center transition-all"
                  style={{ width: '56px', height: '27px' }}
                >
                  <img
                    src={handicap ? '/assets/ontogglebase.svg' : '/assets/offtogglebase.svg'}
                    alt={handicap ? 'On' : 'Off'}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity"
                    style={
                      handicap
                        ? { filter: `hue-rotate(${profileHue - 270}deg) saturate(1.2) brightness(1.1)`, width: '47px', height: '17px' }
                        : { width: '56px', height: '17px' }
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
              <h2 className="text-white font-bold absolute left-1/2 -translate-x-1/2" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 15 }}>
                FORMAT
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* 2. Legs row: 1 LEG | 3 LEG | 5 LEG – default 3 */}
            <div className="flex justify-center gap-2 shrink-0 mb-4">
              <button
                onClick={() => setLegs(1)}
                className="py-2 px-5 rounded-lg border transition-all text-sm font-bold"
                style={{
                  borderColor: legs === 1 ? player.accentColor : '#444',
                  backgroundColor: legs === 1 ? hexToRgba(player.accentColor, 0.2) : 'transparent',
                  color: legs === 1 ? player.accentColor : '#fff',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                }}
              >
                1 LEG
              </button>
              <button
                onClick={() => setLegs(3)}
                className="py-2 px-5 rounded-lg border transition-all text-sm font-bold"
                style={{
                  borderColor: legs === 3 ? player.accentColor : '#444',
                  backgroundColor: legs === 3 ? hexToRgba(player.accentColor, 0.2) : 'transparent',
                  color: legs === 3 ? player.accentColor : '#fff',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                }}
              >
                3 LEG
              </button>
              <button
                onClick={() => setLegs(5)}
                className="py-2 px-5 rounded-lg border transition-all text-sm font-bold"
                style={{
                  borderColor: legs === 5 ? player.accentColor : '#444',
                  backgroundColor: legs === 5 ? hexToRgba(player.accentColor, 0.2) : 'transparent',
                  color: legs === 5 ? player.accentColor : '#fff',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                }}
              >
                5 LEG
              </button>
            </div>

            {/* 3. Slot boxes – fixed size; 1 = one centered; 3 = centered 3; 5 = one each side of same middle 3 */}
            <div className="shrink-0 mb-4 min-h-[48px] flex items-center justify-center">
              <div className="flex items-center justify-center gap-2 w-[312px]">
                {legs === 1 && (
                  <motion.div
                    className="w-14 h-10 rounded-lg border text-center flex items-center justify-center select-none shrink-0"
                    ref={el => { if (el) slotRefs.current[0] = el; }}
                    initial={false}
                    animate={games[0] ? { scale: lastAddedIndex === 0 ? 1.03 : 1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    title={games[0] ? 'Click to deselect' : ''}
                    onClick={() => { if (games[0]) { setGames(prev => { const n = [...prev]; n[0] = ''; return n; }); setLastAddedIndex(null); } }}
                    style={{ borderColor: games[0] ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.15)', backgroundColor: games[0] ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.4)', cursor: games[0] ? 'pointer' : 'default' }}
                    whileHover={games[0] ? { borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.1)' } : {}}
                  >
                    {games[0] && <span className="text-sm font-bold text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{games[0]}</span>}
                  </motion.div>
                )}
                {legs > 1 && legs === 5 && (
                  <motion.div
                    className="w-14 h-10 rounded-lg border text-center flex items-center justify-center select-none shrink-0"
                    ref={el => { if (el) slotRefs.current[0] = el; }}
                    initial={false}
                    animate={games[0] ? { scale: lastAddedIndex === 0 ? 1.03 : 1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    title={games[0] ? 'Click to deselect' : ''}
                    onClick={() => { if (games[0]) { setGames(prev => { const n = [...prev]; n[0] = ''; return n; }); setLastAddedIndex(null); } }}
                    style={{ borderColor: games[0] ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.15)', backgroundColor: games[0] ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.4)', cursor: games[0] ? 'pointer' : 'default' }}
                    whileHover={games[0] ? { borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.1)' } : {}}
                  >
                    {games[0] && <span className="text-sm font-bold text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{games[0]}</span>}
                  </motion.div>
                )}
                {legs > 1 && legs === 3 && <div className="w-14 h-10 shrink-0" aria-hidden />}
                {legs > 1 && [legs === 5 ? 1 : 0, legs === 5 ? 2 : 1, legs === 5 ? 3 : 2].map((idx) => (
                  <motion.div
                    key={idx}
                    className={`w-14 h-10 rounded-lg border text-center flex items-center justify-center select-none shrink-0 ${games[idx] ? 'cursor-pointer' : 'opacity-80'}`}
                    ref={el => { if (el) slotRefs.current[idx] = el; }}
                    initial={false}
                    animate={games[idx] ? { scale: idx === lastAddedIndex ? 1.03 : 1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    title={games[idx] ? 'Click to deselect' : ''}
                    onClick={() => { if (!games[idx]) return; setGames(prev => { const n = [...prev]; n[idx] = ''; return n; }); setLastAddedIndex(null); }}
                    style={{ borderColor: games[idx] ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.15)', backgroundColor: games[idx] ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.4)' }}
                    whileHover={games[idx] ? { borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.1)' } : {}}
                  >
                    <AnimatePresence mode="popLayout">
                      {games[idx] && (
                        <motion.span key={`${idx}-${games[idx]}`} initial={{ y: -10, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="text-sm font-bold text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{games[idx]}</motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
                {legs > 1 && legs === 5 && (
                  <motion.div
                    className="w-14 h-10 rounded-lg border text-center flex items-center justify-center select-none shrink-0"
                    ref={el => { if (el) slotRefs.current[4] = el; }}
                    initial={false}
                    animate={games[4] ? { scale: lastAddedIndex === 4 ? 1.03 : 1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    title={games[4] ? 'Click to deselect' : ''}
                    onClick={() => { if (games[4]) { setGames(prev => { const n = [...prev]; n[4] = ''; return n; }); setLastAddedIndex(null); } }}
                    style={{ borderColor: games[4] ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.15)', backgroundColor: games[4] ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.4)', cursor: games[4] ? 'pointer' : 'default' }}
                    whileHover={games[4] ? { borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.1)' } : {}}
                  >
                    {games[4] && <span className="text-sm font-bold text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{games[4]}</span>}
                  </motion.div>
                )}
                {legs > 1 && legs === 3 && <div className="w-14 h-10 shrink-0" aria-hidden />}
              </div>
            </div>

            {/* 4. Game selection buttons - add to next slot; deselect by clicking the format box above */}
            <div className="flex justify-center gap-3 shrink-0 mb-4">
              <button
                type="button"
                ref={btn501Ref}
                onClick={() => {
                  const i = games.findIndex(x => !x);
                  if (i === -1) return;
                  if (legs > 1) {
                    const src = btn501Ref.current;
                    const dst = slotRefs.current[i];
                    if (src && dst) {
                      const s = src.getBoundingClientRect();
                      const d = dst.getBoundingClientRect();
                      setFlight({ id: ++flightIdRef.current, label: '501', from: { x: s.left + s.width / 2, y: s.top + s.height / 2 }, to: { x: d.left + d.width / 2, y: d.top + d.height / 2 } });
                    }
                  } else {
                    setGlowGame('501');
                  }
                  addGame('501');
                }}
                className="rounded-lg px-6 py-3 text-lg border transition-colors bg-zinc-900/40 hover:bg-white/5 text-white"
                style={{
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                  ...(gamesInclude501 ? { borderColor: player.accentColor, boxShadow: glowGame === '501' ? `0 0 0 2px ${hexToRgba(player.accentColor, 0.5)}, 0 0 20px ${hexToRgba(player.accentColor, 0.6)}` : `0 0 0 2px ${hexToRgba(player.accentColor, 0.5)}` } : { borderColor: 'rgba(255,255,255,0.15)', ...(glowGame === '501' ? { boxShadow: `0 0 20px ${hexToRgba(player.accentColor, 0.6)}` } : {}) }),
                }}
              >
                501
              </button>
              <button
                type="button"
                ref={btnCRRef}
                onClick={() => {
                  const i = games.findIndex(x => !x);
                  if (i === -1) return;
                  if (legs > 1) {
                    const src = btnCRRef.current;
                    const dst = slotRefs.current[i];
                    if (src && dst) {
                      const s = src.getBoundingClientRect();
                      const d = dst.getBoundingClientRect();
                      setFlight({ id: ++flightIdRef.current, label: 'CR', from: { x: s.left + s.width / 2, y: s.top + s.height / 2 }, to: { x: d.left + d.width / 2, y: d.top + d.height / 2 } });
                    }
                  } else {
                    setGlowGame('CR');
                  }
                  addGame('CR');
                }}
                className="rounded-lg px-6 py-3 text-lg border transition-colors bg-zinc-900/40 hover:bg-white/5 text-white"
                style={{
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                  ...(gamesIncludeCR ? { borderColor: player.accentColor, boxShadow: glowGame === 'CR' ? `0 0 0 2px ${hexToRgba(player.accentColor, 0.5)}, 0 0 20px ${hexToRgba(player.accentColor, 0.6)}` : `0 0 0 2px ${hexToRgba(player.accentColor, 0.5)}` } : { borderColor: 'rgba(255,255,255,0.15)', ...(glowGame === 'CR' ? { boxShadow: `0 0 20px ${hexToRgba(player.accentColor, 0.6)}` } : {}) }),
                }}
              >
                CR
              </button>
              <button
                type="button"
                ref={btnCHRef}
                onClick={() => {
                  if (chDisabled) return;
                  const i = games.findIndex(x => !x);
                  if (i === -1) return;
                  if (legs > 1) {
                    const src = btnCHRef.current;
                    const dst = slotRefs.current[i];
                    if (src && dst) {
                      const s = src.getBoundingClientRect();
                      const d = dst.getBoundingClientRect();
                      setFlight({ id: ++flightIdRef.current, label: 'CH', from: { x: s.left + s.width / 2, y: s.top + s.height / 2 }, to: { x: d.left + d.width / 2, y: d.top + d.height / 2 } });
                    }
                  } else {
                    setGlowGame('CH');
                  }
                  addGame('CH');
                }}
                disabled={chDisabled}
                title={chDisabled ? (legs <= 1 ? 'Choice only for 3 or 5 leg' : 'Fill all other legs first') : ''}
                className={`rounded-lg px-6 py-3 text-lg border transition-colors ${chDisabled ? 'border-white/15 bg-zinc-900/40 text-zinc-500 opacity-40 cursor-not-allowed' : 'bg-zinc-900/40 hover:bg-white/5 text-white'}`}
                style={{
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                  ...(gamesIncludeCH ? { borderColor: player.accentColor, boxShadow: glowGame === 'CH' ? `0 0 0 2px ${hexToRgba(player.accentColor, 0.5)}, 0 0 20px ${hexToRgba(player.accentColor, 0.6)}` : `0 0 0 2px ${hexToRgba(player.accentColor, 0.5)}` } : { borderColor: 'rgba(255,255,255,0.15)', ...(glowGame === 'CH' ? { boxShadow: `0 0 20px ${hexToRgba(player.accentColor, 0.6)}` } : {}) }),
                }}
              >
                CH
              </button>
            </div>

            {/* 5. 01 format + bull (centered) and Send on right – same line; no extra space below */}
            <div className="shrink-0 mb-0">
              <div className="flex items-center w-full">
                <div className="flex-1 flex justify-center gap-1.5 flex-wrap py-1">
                  <button type="button" disabled={!has01Game} onClick={() => has01Game && setDo_(prev => { const n = !prev; if (n) { setMo(false); setMimo(false); setDido(false); } return n; })}
                    className="rounded-lg px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: !has01Game ? 'rgba(255,255,255,0.08)' : do_ ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)', backgroundColor: !has01Game ? 'rgba(24,24,27,0.4)' : do_ ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)', color: !has01Game ? 'rgb(113,113,122)' : do_ ? 'white' : 'rgb(212,212,216)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>Do</button>
                  <button type="button" disabled={!has01Game} onClick={() => has01Game && setMo(prev => { const n = !prev; if (n) { setDo_(false); setMimo(false); setDido(false); } return n; })}
                    className="rounded-lg px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: !has01Game ? 'rgba(255,255,255,0.08)' : mo ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)', backgroundColor: !has01Game ? 'rgba(24,24,27,0.4)' : mo ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)', color: !has01Game ? 'rgb(113,113,122)' : mo ? 'white' : 'rgb(212,212,216)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>Mo</button>
                  <button type="button" disabled={!has01Game} onClick={() => has01Game && setMimo(prev => { const n = !prev; if (n) { setDo_(false); setMo(false); setDido(false); } return n; })}
                    className="rounded-lg px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: !has01Game ? 'rgba(255,255,255,0.08)' : mimo ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)', backgroundColor: !has01Game ? 'rgba(24,24,27,0.4)' : mimo ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)', color: !has01Game ? 'rgb(113,113,122)' : mimo ? 'white' : 'rgb(212,212,216)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>MiMo</button>
                  <button type="button" disabled={!has01Game} onClick={() => has01Game && setDido(prev => { const n = !prev; if (n) { setMo(false); setMimo(false); setDo_(false); } return n; })}
                    className="rounded-lg px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: !has01Game ? 'rgba(255,255,255,0.08)' : dido ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)', backgroundColor: !has01Game ? 'rgba(24,24,27,0.4)' : dido ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)', color: !has01Game ? 'rgb(113,113,122)' : dido ? 'white' : 'rgb(212,212,216)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>DiDo</button>
                  <div className="w-2" />
                  <button type="button" disabled={!has01Game} onClick={() => has01Game && setFull(prev => { const n = !prev; if (n) setSplit(false); return n; })}
                    className="rounded-lg px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: !has01Game ? 'rgba(255,255,255,0.08)' : full ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)', backgroundColor: !has01Game ? 'rgba(24,24,27,0.4)' : full ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)', color: !has01Game ? 'rgb(113,113,122)' : full ? 'white' : 'rgb(212,212,216)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>Full</button>
                  <button type="button" disabled={!has01Game} onClick={() => has01Game && setSplit(prev => { const n = !prev; if (n) setFull(false); return n; })}
                    className="rounded-lg px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: !has01Game ? 'rgba(255,255,255,0.08)' : split ? hexToRgba(player.accentColor, 0.6) : 'rgba(255,255,255,0.1)', backgroundColor: !has01Game ? 'rgba(24,24,27,0.4)' : split ? hexToRgba(player.accentColor, 0.1) : 'rgba(24,24,27,0.6)', color: !has01Game ? 'rgb(113,113,122)' : split ? 'white' : 'rgb(212,212,216)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>Split</button>
                </div>
                <motion.button
                  type="button"
                  onClick={canSend ? handleStartGame : undefined}
                  disabled={!canSend}
                  className="rounded-lg p-2 transition-colors flex items-center justify-center shrink-0 border-0"
                  title={canSend ? 'Review & send' : allSlotsFilled ? 'Select 01 format (Do/Mo/MiMo/DiDo) and bull (Full/Split)' : `Fill all ${legs} game slot(s)${has01Game ? ' and 01 + bull format' : ''}`}
                  animate={canSend ? { scale: [1, 1.08, 1], boxShadow: [`0 0 0 0 ${hexToRgba(player.accentColor, 0)}`, `0 0 16px 2px ${hexToRgba(player.accentColor, 0.5)}`, `0 0 0 0 ${hexToRgba(player.accentColor, 0)}`] } : {}}
                  transition={canSend ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } : {}}
                  style={{
                    backgroundColor: canSend ? hexToRgba(player.accentColor, 0.15) : 'rgba(24,24,27,0.6)',
                    color: canSend ? player.accentColor : 'rgb(113,113,122)',
                  }}
                >
                  <Send className="w-5 h-5" strokeWidth={2.2} />
                </motion.button>
              </div>
            </div>
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
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 max-w-sm w-full shadow-xl"
            >
              <h3 className="text-base font-semibold text-white mb-4 text-center" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                Confirm Game Request
              </h3>
              <dl className="space-y-3 mb-5">
                <div className="flex gap-3 items-baseline">
                  <dt className="text-zinc-400 text-sm shrink-0 w-20" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Opponent</dt>
                  <dd className="text-white font-medium text-sm truncate" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{player.granboardName}</dd>
                </div>
                <div className="flex gap-3 items-baseline">
                  <dt className="text-zinc-400 text-sm shrink-0 w-20" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Legs</dt>
                  <dd className="text-white font-medium text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{legs}</dd>
                </div>
                <div className="flex gap-3 items-baseline">
                  <dt className="text-zinc-400 text-sm shrink-0 w-20" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Games</dt>
                  <dd className="text-white font-medium text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{games.filter(g => g).join(', ')}</dd>
                </div>
                {getFormatDescription() && (
                  <div className="flex gap-3">
                    <dt className="text-zinc-400 text-sm shrink-0 w-20" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Format</dt>
                    <dd className="text-white/90 text-sm leading-snug" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{getFormatDescription()}</dd>
                  </div>
                )}
                {handicap && (
                  <div className="flex gap-3 items-baseline">
                    <dt className="text-zinc-400 text-sm shrink-0 w-20" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Handicap</dt>
                    <dd className="text-white font-medium text-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>On</dd>
                  </div>
                )}
              </dl>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition-colors text-sm font-medium"
                  style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAndSendRequest}
                  className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors hover:opacity-95"
                  style={{ backgroundColor: player.accentColor, fontFamily: 'Helvetica, Arial, sans-serif' }}
                >
                  Send Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
