import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { OnlineLobby } from './pages/OnlineLobby';
import { LocalDubsSetup } from './pages/LocalDubsSetup';
import { RemoteDubsSetup } from './pages/RemoteDubsSetup';
import { O1InhouseGameScreen } from './pages/01InhouseGameScreen';
import { O1GSPreview } from './pages/preview/01GSPreview';
import { CRGSPreview } from './pages/preview/CRGSPreview';
import { CorkPreview } from './pages/preview/CorkPreview';
import { Online01Preview } from './pages/preview/Online01Preview';
import { OnlineCRPreview } from './pages/preview/OnlineCRPreview';
import PreviewIndex from './pages/preview/PreviewIndex';
import { CROnlineGameScreen } from './pages/CROnlineGameScreen';
import { CRInhouseGameScreen } from './pages/CRInhouseGameScreen';
import { O1OnlineGameScreen } from './pages/01OnlineGameScreen';
import { MedleyMatchManager } from './pages/MedleyMatchManager';
import { SettingsModal } from './components/SettingsModal';
import { iOSBluefyBanner } from './components/iOSBluefyBanner';
import { createClient } from './utils/supabase/client';
import { useBLE } from './contexts/BLEContext';
import { useGame, type GameData } from './contexts/GameContext';

type GameRequestNotification = {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  createdAt: string;
  schema: 'player' | 'youth';
};

export default function App() {
  const rawNavigate = useNavigate();
  const location = useLocation();

  // Wrap navigate to preserve query params (like ?dev=1)
  const navigate = (path: string) => {
    rawNavigate(`${path}${location.search}`);
  };

  // Context hooks
  const { isConnected: bleConnected, connect: bleConnect, disconnect: bleDisconnect, status: bleStatus } = useBLE();
  const { activeGame, setActiveGame, partner, setPartner, pendingRejoinGame, setPendingRejoinGame, clearGameState } = useGame();

  // User/auth state (stays in App.tsx for now)
  const [accentColor, setAccentColor] = useState('#a855f7');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isYouthPlayer, setIsYouthPlayer] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  const [hasActiveLeague, setHasActiveLeague] = useState(false);
  const [hasParentPaired, setHasParentPaired] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [missedRequests, setMissedRequests] = useState<GameRequestNotification[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const supabase = createClient();
  const locationRef = useRef(location.pathname);

  const removeActiveGame = useCallback(
    async (gameId?: string, playerIdOverride?: string) => {
      const playerId = playerIdOverride || userId;
      if (!playerId && !gameId) return;

      const orFilter = gameId
        ? `id.eq.${gameId},player1_id.eq.${playerId},player2_id.eq.${playerId}`
        : `player1_id.eq.${playerId},player2_id.eq.${playerId}`;

      try {
        // Mark as abandoned so rejoin queries ignore it, even if delete fails
        await (supabase as any)
          .schema('companion')
          .from('active_games')
          .update({ status: 'abandoned' })
          .or(orFilter)
          .in('status', ['pending', 'accepted', 'playing']);
      } catch (err) {
        console.error('Error marking game abandoned:', err);
      }

      try {
        await (supabase as any)
          .schema('companion')
          .from('active_games')
          .delete()
          .or(orFilter);
      } catch (err) {
        console.error('Error deleting active game:', err);
      }

      try {
        if (playerId) {
          await (supabase as any)
            .schema('companion')
            .from('online_lobby')
            .update({ status: 'waiting', last_seen: new Date().toISOString() })
            .eq('player_id', playerId);
        }
      } catch (err) {
        console.error('Error resetting lobby status:', err);
      }

      // Clear abandoned flag locally
      if (gameId) localStorage.removeItem('bb-abandoned-game');
      sessionStorage.removeItem('blebuddy_game');
      setActiveGame(null);
      setPendingRejoinGame(null);
    },
    [supabase, userId, setActiveGame, setPendingRejoinGame]
  );

  // Lock screen orientation to landscape when possible
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape');
        }
      } catch {
        // Screen orientation lock not supported, using CSS fallback
      }
    };
    lockOrientation();
  }, []);

  // Check authentication and fetch user's profile data from Supabase
  useEffect(() => {
    async function checkAuthAndFetchProfile() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);
        setUserId(session.user.id);

        // Fetch profile - try player schema first, then youth schema
        // Note: supabase client defaults to 'player' schema in client.ts
        const { data: playerData, error: playerError } = await supabase
          .from('player_profiles')
          .select('profilecolor, profilepic, role, gender, birthday_month, birthday_day, birthday_year, granboard_name')
          .eq('id', session.user.id)
          .single();

        let profileData: any = playerData;

        if (playerError || !playerData) {
          const { data: youthData } = await (supabase as any)
            .schema('youth')
            .from('youth_profiles')
            .select('profilecolor, profilepic, role, gender, birthday_month, birthday_day, birthday_year, parent_id, granboard_name')
            .eq('id', session.user.id)
            .single();

          if (youthData) {
            profileData = youthData;
            setIsYouthPlayer(true);
            if (youthData.parent_id) setHasParentPaired(true);
          }
        }

        if (profileData?.granboard_name) setUserName(profileData.granboard_name);
        if (profileData?.role) setUserRole(profileData.role);
        if (profileData?.gender) setUserGender(profileData.gender);

        if (profileData?.birthday_year && profileData?.birthday_month && profileData?.birthday_day) {
          const birthDate = new Date(profileData.birthday_year, profileData.birthday_month - 1, profileData.birthday_day);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
          setUserAge(age);
        }

        // Check for active tournament
        try {
          const { data: tournamentData } = await (supabase as any)
            .schema('tournament')
            .from('tournament_registrations')
            .select('id')
            .eq('player_id', session.user.id)
            .eq('status', 'active')
            .limit(1);
          if (tournamentData && tournamentData.length > 0) setHasActiveTournament(true);
        } catch {}

        // Check for active league
        try {
          const { data: leagueData } = await (supabase as any)
            .schema('league')
            .from('league_schedules')
            .select('id')
            .eq('player_id', session.user.id)
            .eq('status', 'scheduled')
            .limit(1);
          if (leagueData && leagueData.length > 0) setHasActiveLeague(true);
        } catch {}

        if (profileData?.profilecolor) setAccentColor(profileData.profilecolor);

        // profilepic is either a full URL or an assets/ path - use directly
        if (profileData?.profilepic) {
          setProfilePic(profileData.profilepic);
        }

        // Check for active games to rejoin
        try {
          // If user previously abandoned, clear the flag and skip the rejoin check entirely
          const abandonedId = localStorage.getItem('bb-abandoned-game');
          if (abandonedId) {
            // Try to clean up the abandoned game
            await (supabase as any)
              .schema('companion')
              .from('active_games')
              .delete()
              .eq('id', abandonedId);
            localStorage.removeItem('bb-abandoned-game');
            sessionStorage.removeItem('blebuddy_game');
            // Don't show rejoin prompt - user explicitly abandoned
          } else {
            // Only check for rejoin if user didn't abandon
            // Use completed_at IS NULL to ensure we only find truly active games
            const { data: activeGames } = await (supabase as any)
              .schema('companion')
              .from('active_games')
              .select('id, player1_id, player2_id, player1_granboard_name, player2_granboard_name, status, created_at, completed_at, game_type, game_config')
              .or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`)
              .in('status', ['accepted', 'playing'])
              .is('completed_at', null);

            const validGame = activeGames?.find((g: any) => g.status === 'accepted' || g.status === 'playing');

            if (validGame) {
              const isPlayer1 = validGame.player1_id === session.user.id;
              setPendingRejoinGame({
                gameId: validGame.id,
                opponentId: isPlayer1 ? validGame.player2_id : validGame.player1_id,
                opponentName: (isPlayer1 ? validGame.player2_granboard_name : validGame.player1_granboard_name) || 'Opponent',
                isInitiator: isPlayer1,
                gameType: validGame.game_type || null,
                gameConfig: validGame.game_config || null,
              });
            }
          }
        } catch (err) {
          console.error('[App] Error checking for rejoin games:', err);
        }
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndFetchProfile();
  }, []);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // Note: activeGame persistence is now handled by GameContext

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      localStorage.removeItem('sb-sndsyxxcnuwjmjgikzgg-auth-token');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsAuthenticated(false);
      setUserId('');
      setUserName('');
      setProfilePic(null);
      setAccentColor('#a855f7');
      clearGameState(); // Clears partner, activeGame, pendingRejoinGame
      setIsYouthPlayer(false);
      setUserRole(null);
      setUserGender(null);
      setUserAge(null);
      setHasActiveLeague(false);
      setHasActiveTournament(false);
      setHasParentPaired(false);
      setMissedRequests([]);
      navigate('/login');
    }
  };

  // Listen for game requests
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const schemas: Array<'player' | 'youth'> = ['player', 'youth'];
    const channels = schemas.map(schema =>
      supabase
        .channel(`active-games-${schema}-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema,
            table: 'active_games',
            filter: `player2_id=eq.${userId}`,
          },
          async payload => {
            if (!payload.new) return;
            if (locationRef.current === '/online-lobby') return;

            const data = payload.new as Record<string, any>;
            const challengerId = data.player1_id as string | undefined;
            if (!challengerId) return;

            const notificationId = `${schema}-${data.id}`;
            let challengerName = 'Opponent';

            try {
              const profileQuery = schema === 'youth'
                ? (supabase as any).schema('youth').from('youth_profiles')
                : supabase.from('player_profiles');
              const { data: profile } = await profileQuery.select('granboard_name').eq('id', challengerId).single();
              if ((profile as any)?.granboard_name) challengerName = (profile as any).granboard_name;
            } catch {}

            setMissedRequests(prev => {
              if (prev.some(n => n.id === notificationId)) return prev;
              return [...prev, {
                id: notificationId,
                fromPlayerId: challengerId,
                fromPlayerName: challengerName,
                createdAt: data.created_at || new Date().toISOString(),
                schema,
              }];
            });
          }
        )
        .subscribe()
    );

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [isAuthenticated, userId, supabase]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    window.location.reload();
  };

  const handleRejoinGame = () => {
    if (!pendingRejoinGame) return;
    setActiveGame({
      gameId: pendingRejoinGame.gameId,
      opponentId: pendingRejoinGame.opponentId,
      opponentName: pendingRejoinGame.opponentName,
      opponentProfilePic: undefined,
      opponentAccentColor: '#a855f7',
      isInitiator: pendingRejoinGame.isInitiator,
      gameType: pendingRejoinGame.gameType || null,
      gameConfig: pendingRejoinGame.gameConfig || null,
    });
    setPendingRejoinGame(null);
    navigate('/cork');
  };

  const handleAbandonGame = async () => {
    if (!pendingRejoinGame) return;
    const gameId = pendingRejoinGame.gameId;

    // Clear local state FIRST so prompt disappears immediately
    localStorage.setItem('bb-abandoned-game', gameId);
    sessionStorage.removeItem('blebuddy_game');
    setPendingRejoinGame(null);
    setActiveGame(null);

    // Then try to delete from DB (non-blocking)
    try {
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .eq('id', gameId);
      localStorage.removeItem('bb-abandoned-game');
    } catch (err) {
      console.error('[App] Error deleting abandoned game:', err);
      // Keep the localStorage flag so next load will retry cleanup
    }

    navigate('/dashboard');
  };

  const handleGameAccepted = (gameData: GameData) => {
    setActiveGame(gameData);
    navigate('/cork');
  };

  const handleCorkComplete = (firstPlayerId: string) => {
    if (activeGame) {
      setActiveGame({ ...activeGame, corkWinnerId: firstPlayerId });
    }
    const configuredGames = activeGame?.gameConfig?.games || [];
    const isMedley = configuredGames.length > 1 || activeGame?.gameType === 'medley';
    if (isMedley) {
      navigate('/game/match');
      return;
    }
    const firstGame = configuredGames.find(game => game) || activeGame?.gameType || 'cricket';
    const normalized = firstGame.toLowerCase();
    const nextRoute = normalized === 'cricket' || normalized === 'cr' ? '/game/cricket' : '/game/01-online';
    navigate(nextRoute);
  };

  const handleCorkCancel = async () => {
    await removeActiveGame(activeGame?.gameId);
    setActiveGame(null);
    setPendingRejoinGame(null);
    navigate('/online-lobby');
  };

  const handleLeaveMatch = async () => {
    await removeActiveGame(activeGame?.gameId);
    setActiveGame(null);
    setPendingRejoinGame(null);
    navigate('/dashboard');
  };

  const handleLocalDubsContinue = async (partnerId: string, _userGoesFirst: boolean) => {
    try {
      const { data: partnerData } = await supabase.from('player_profiles').select('granboard_name').eq('id', partnerId).single();
      if (!partnerData) {
        const { data: youthPartnerData } = await (supabase as any).schema('youth').from('youth_profiles').select('granboard_name').eq('id', partnerId).single();
        if (youthPartnerData) setPartner({ id: partnerId, name: youthPartnerData.granboard_name });
      } else {
        setPartner({ id: partnerId, name: (partnerData as any).granboard_name });
      }
    } catch {}
    navigate('/online-lobby');
  };

  const handleRemoteDubsContinue = async (partnerId: string) => {
    try {
      const { data: partnerData } = await supabase.from('player_profiles').select('granboard_name').eq('id', partnerId).single();
      if (partnerData) setPartner({ id: partnerId, name: (partnerData as any).granboard_name });
    } catch {}
    navigate('/online-lobby');
  };

  const handlePreviewLeave = () => {
    navigate('/preview');
  };

  // Preview routes bypass ALL auth/loading checks
  const isPreviewRoute = location.pathname.startsWith('/preview');

  if (loading && !isPreviewRoute) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Loading...</div>
      </div>
    );
  }

  // Rejoin game prompt (skip for preview routes)
  if (pendingRejoinGame && !isPreviewRoute) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full">
          <h2 className="text-white text-xl font-bold mb-2">Active Match Found</h2>
          <p className="text-zinc-400 text-sm mb-4">
            You have an ongoing match with <span className="text-white font-semibold">{pendingRejoinGame.opponentName}</span>.
          </p>
          <div className="flex gap-3">
            <button onClick={handleAbandonGame} className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors">Abandon Match</button>
            <button onClick={handleRejoinGame} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors">Rejoin Match</button>
          </div>
        </div>
      </div>
    );
  }

  // Preserve query params (like ?dev=1) in navigations
  const queryString = location.search;

  return (
    <>
    <iOSBluefyBanner />
    <Routes>
      {/* Preview screens - NO AUTH, must be first */}
      <Route path="/preview" element={<PreviewIndex />} />
      <Route path="/preview/01" element={<O1GSPreview onLeaveMatch={handlePreviewLeave} />} />
      <Route path="/preview/cr" element={<CRGSPreview onLeaveMatch={handlePreviewLeave} />} />
      <Route path="/preview/cork" element={<CorkPreview onLeaveMatch={handlePreviewLeave} />} />
      <Route path="/preview/01-online" element={<Online01Preview />} />
      <Route path="/preview/cr-online" element={<OnlineCRPreview />} />

      <Route path="/login" element={isAuthenticated ? <Navigate to={`/dashboard${queryString}`} /> : <Login onLoginSuccess={handleLoginSuccess} />} />

      <Route path="/dashboard" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        <Dashboard
          userId={userId}
          isYouthPlayer={isYouthPlayer}
          userRole={userRole}
          userGender={userGender}
          userAge={userAge}
          hasActiveTournament={hasActiveTournament}
          hasActiveLeague={hasActiveLeague}
          bleConnected={bleConnected}
          bleStatus={bleStatus === 'error' ? 'disconnected' : bleStatus}
          onBLEConnect={bleConnect}
          onBLEDisconnect={bleDisconnect}
          onNavigateToOnlineLobby={() => navigate('/online-lobby')}
          onNavigateToLocalDubs={() => navigate('/local-dubs-setup')}
          onNavigateToRemoteDubs={() => navigate('/remote-dubs-setup')}
          missedRequests={missedRequests}
          onClearMissedRequests={() => setMissedRequests([])}
          onLogout={handleLogout}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      } />

      <Route path="/online-lobby" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        <OnlineLobby
          onBack={() => { setPartner(null); setActiveGame(null); navigate('/dashboard'); }}
          accentColor={accentColor}
          userId={userId}
          isYouthPlayer={isYouthPlayer}
          hasParentPaired={hasParentPaired}
          isDoublesTeam={partner !== null}
          partnerId={partner?.id}
          partnerName={partner?.name}
          profilePic={profilePic}
          userName={userName}
          onLogout={handleLogout}
          onGameAccepted={handleGameAccepted}
          missedRequests={missedRequests.map(r => ({ id: r.id, challengerName: r.fromPlayerName, challengerId: r.fromPlayerId, timestamp: r.createdAt }))}
          onClearMissedRequests={() => setMissedRequests([])}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      } />

      <Route path="/local-dubs-setup" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        <LocalDubsSetup
          onBack={() => navigate('/dashboard')}
          onContinue={handleLocalDubsContinue}
          accentColor={accentColor}
          userId={userId}
          userProfilePic={profilePic}
          userName={userName}
          onLogout={handleLogout}
        />
      } />

      <Route path="/remote-dubs-setup" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        <RemoteDubsSetup
          onBack={() => navigate('/dashboard')}
          onContinue={handleRemoteDubsContinue}
          accentColor={accentColor}
          userId={userId}
          userProfilePic={profilePic}
          userName={userName}
          onLogout={handleLogout}
        />
      } />

      <Route path="/cork" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        !activeGame ? <Navigate to={`/dashboard${queryString}`} /> :
        <CorkScreen
          player1={{ id: userId, name: userName, profilePic: profilePic || undefined, accentColor }}
          player2={{ id: activeGame.opponentId, name: activeGame.opponentName, profilePic: activeGame.opponentProfilePic, accentColor: activeGame.opponentAccentColor }}
          gameId={activeGame.gameId}
          visiblePlayerId={userId}
          isInitiator={activeGame.isInitiator}
          onCorkComplete={handleCorkComplete}
          onCancel={handleCorkCancel}
        />
      } />

      {/* Game screen (requires auth) */}
      <Route path="/game-preview" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        <O1InhouseGameScreen onLeaveMatch={handleLeaveMatch} />
      } />

      {/* Production games - no auth for testing */}
      <Route path="/game/01-inhouse" element={<O1InhouseGameScreen onLeaveMatch={() => window.location.href = '/dashboard'} />} />
      <Route path="/game/01-online" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        !activeGame ? <Navigate to={`/dashboard${queryString}`} /> :
        <O1OnlineGameScreen
          gameId={activeGame.gameId}
          localPlayer={{
            id: userId,
            name: userName,
            profilePic: profilePic || undefined,
            accentColor: accentColor,
          }}
          remotePlayer={{
            id: activeGame.opponentId,
            name: activeGame.opponentName,
            profilePic: activeGame.opponentProfilePic,
            accentColor: activeGame.opponentAccentColor,
          }}
          isInitiator={activeGame.isInitiator}
          gameType={activeGame.gameConfig?.games?.find(game => game) || activeGame.gameType || undefined}
          startingPlayer={activeGame.corkWinnerId
            ? (activeGame.corkWinnerId === (activeGame.isInitiator ? userId : activeGame.opponentId) ? 'p1' : 'p2')
            : 'p1'}
          gameConfig={activeGame.gameConfig}
          onLeaveMatch={handleLeaveMatch}
        />
      } />
      <Route path="/game/cricket-inhouse" element={<CRInhouseGameScreen onLeaveMatch={() => window.location.href = '/dashboard'} />} />

      {/* Cricket online game */}
      <Route path="/game/cricket" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        !activeGame ? <Navigate to={`/dashboard${queryString}`} /> :
        <CROnlineGameScreen
          gameId={activeGame.gameId}
          localPlayer={{
            id: userId,
            name: userName,
            profilePic: profilePic || undefined,
            accentColor: accentColor,
          }}
          remotePlayer={{
            id: activeGame.opponentId,
            name: activeGame.opponentName,
            profilePic: activeGame.opponentProfilePic,
            accentColor: activeGame.opponentAccentColor,
          }}
          isInitiator={activeGame.isInitiator}
          startingPlayer={activeGame.corkWinnerId
            ? (activeGame.corkWinnerId === (activeGame.isInitiator ? userId : activeGame.opponentId) ? 'p1' : 'p2')
            : 'p1'}
          onLeaveMatch={handleLeaveMatch}
        />
      } />

      {/* Online medley manager */}
      <Route path="/game/match" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        !activeGame ? <Navigate to={`/dashboard${queryString}`} /> :
        <MedleyMatchManager
          gameId={activeGame.gameId}
          localPlayer={{
            id: userId,
            name: userName,
            profilePic: profilePic || undefined,
            accentColor: accentColor,
          }}
          remotePlayer={{
            id: activeGame.opponentId,
            name: activeGame.opponentName,
            profilePic: activeGame.opponentProfilePic,
            accentColor: activeGame.opponentAccentColor,
          }}
          isInitiator={activeGame.isInitiator}
          gameConfig={activeGame.gameConfig}
          corkWinnerId={activeGame.corkWinnerId || null}
          onLeaveMatch={handleLeaveMatch}
        />
      } />

      <Route path="/" element={<Navigate to={isAuthenticated ? `/dashboard${queryString}` : `/login${queryString}`} />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? `/dashboard${queryString}` : `/login${queryString}`} />} />
    </Routes>

    <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </>
  );
}
