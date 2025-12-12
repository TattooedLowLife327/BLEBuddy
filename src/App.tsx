import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { OnlineLobby } from './pages/OnlineLobby';
import { LocalDubsSetup } from './pages/LocalDubsSetup';
import { RemoteDubsSetup } from './pages/RemoteDubsSetup';
import { CorkScreen } from './components/CorkScreen';
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const supabase = createClient();
  const locationRef = useRef(location.pathname);

  // Lock screen orientation to landscape when possible
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        if (screen.orientation && 'lock' in screen.orientation) {
          await screen.orientation.lock('landscape');
        }
      } catch (err) {
        console.log('Screen orientation lock not supported, using CSS fallback');
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
        const { data: playerData, error: playerError } = await supabase
          .from('player_profiles')
          .select('profilecolor, profilepic, role, gender, birthday_month, birthday_day, birthday_year, granboard_name')
          .eq('id', session.user.id)
          .single();

        let profileData = playerData;

        if (playerError || !playerData) {
          const { data: youthData } = await supabase
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
          const { data: tournamentData } = await supabase
            .schema('tournament')
            .from('tournament_registrations')
            .select('id')
            .eq('player_id', session.user.id)
            .eq('status', 'active')
            .limit(1);
          if (tournamentData && tournamentData.length > 0) setHasActiveTournament(true);
        } catch (err) {}

        // Check for active league
        try {
          const { data: leagueData } = await supabase
            .schema('league')
            .from('league_schedules')
            .select('id')
            .eq('player_id', session.user.id)
            .eq('status', 'scheduled')
            .limit(1);
          if (leagueData && leagueData.length > 0) setHasActiveLeague(true);
        } catch (err) {}

        if (profileData?.profilecolor) setAccentColor(profileData.profilecolor);

        if (profileData?.profilepic) {
          if (profileData.profilepic.startsWith('http')) {
            setProfilePic(profileData.profilepic);
          } else if (profileData.profilepic.startsWith('/assets') || profileData.profilepic.startsWith('assets') || profileData.profilepic === 'default-pfp.png') {
            const localPath = profileData.profilepic.startsWith('/') ? profileData.profilepic : `/${profileData.profilepic}`;
            setProfilePic(localPath);
          } else {
            const { data: urlData } = supabase.storage.from('profilepic').getPublicUrl(profileData.profilepic);
            setProfilePic(urlData.publicUrl);
          }
        }

        // Check for active games to rejoin
        try {
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
          const { data: activeGames } = await (supabase as any)
            .schema('companion')
            .from('active_games')
            .select('id, player1_id, player2_id, player1_granboard_name, player2_granboard_name, status, created_at')
            .or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`)
            .in('status', ['accepted', 'playing'])
            .gte('created_at', twoHoursAgo);

          if (activeGames && activeGames.length > 0) {
            const game = activeGames[0];
            const isPlayer1 = game.player1_id === session.user.id;
            setPendingRejoinGame({
              gameId: game.id,
              opponentId: isPlayer1 ? game.player2_id : game.player1_id,
              opponentName: (isPlayer1 ? game.player2_granboard_name : game.player1_granboard_name) || 'Opponent',
              isInitiator: isPlayer1,
            });
          }
        } catch (err) {}
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
      setIsLoggingOut(true);
      await supabase.auth.signOut({ scope: 'local' });
      localStorage.removeItem('sb-sndsyxxcnuwjmjgikzgg-auth-token');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
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
                ? supabase.schema('youth').from('youth_profiles')
                : supabase.from('player_profiles');
              const { data: profile } = await profileQuery.select('granboard_name').eq('id', challengerId).single();
              if (profile?.granboard_name) challengerName = profile.granboard_name;
            } catch (error) {}

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
    });
    setPendingRejoinGame(null);
    navigate('/cork');
  };

  const handleAbandonGame = async () => {
    if (!pendingRejoinGame) return;
    try {
      await (supabase as any)
        .schema('companion')
        .from('active_games')
        .delete()
        .eq('id', pendingRejoinGame.gameId)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
    } catch (err) {}
    setPendingRejoinGame(null);
    navigate('/dashboard');
  };

  const handleGameAccepted = (gameData: GameData) => {
    setActiveGame(gameData);
    navigate('/cork');
  };

  const handleCorkComplete = (firstPlayerId: string) => {
    alert(`${firstPlayerId === userId ? 'You throw' : 'Opponent throws'} first! Game screen coming soon...`);
    setActiveGame(null);
    navigate('/dashboard');
  };

  const handleCorkCancel = () => {
    setActiveGame(null);
    navigate('/online-lobby');
  };

  const handleLocalDubsContinue = async (partnerId: string, userGoesFirst: boolean) => {
    try {
      const { data: partnerData } = await supabase.from('player_profiles').select('granboard_name').eq('id', partnerId).single();
      if (!partnerData) {
        const { data: youthPartnerData } = await supabase.schema('youth').from('youth_profiles').select('granboard_name').eq('id', partnerId).single();
        if (youthPartnerData) setPartner({ id: partnerId, name: youthPartnerData.granboard_name });
      } else {
        setPartner({ id: partnerId, name: partnerData.granboard_name });
      }
    } catch (err) {}
    navigate('/online-lobby');
  };

  const handleRemoteDubsContinue = async (partnerId: string) => {
    try {
      const { data: partnerData } = await supabase.from('player_profiles').select('granboard_name').eq('id', partnerId).single();
      if (partnerData) setPartner({ id: partnerId, name: partnerData.granboard_name });
    } catch (err) {}
    navigate('/online-lobby');
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Loading...</div>
      </div>
    );
  }

  // Rejoin game prompt
  if (pendingRejoinGame) {
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
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={`/dashboard${queryString}`} /> : <Login onLoginSuccess={handleLoginSuccess} />} />

      <Route path="/dashboard" element={
        !isAuthenticated ? <Navigate to={`/login${queryString}`} /> :
        <Dashboard
          userId={userId}
          userName={userName}
          profilePic={profilePic}
          accentColor={accentColor}
          isYouthPlayer={isYouthPlayer}
          userRole={userRole}
          userGender={userGender}
          userAge={userAge}
          hasActiveTournament={hasActiveTournament}
          hasActiveLeague={hasActiveLeague}
          bleConnected={bleConnected}
          bleStatus={bleStatus}
          onBLEConnect={bleConnect}
          onBLEDisconnect={bleDisconnect}
          onNavigateToOnlineLobby={() => navigate('/online-lobby')}
          onNavigateToLocalDubs={() => navigate('/local-dubs-setup')}
          onNavigateToRemoteDubs={() => navigate('/remote-dubs-setup')}
          missedRequests={missedRequests}
          onClearMissedRequests={() => setMissedRequests([])}
          onLogout={handleLogout}
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

      <Route path="/" element={<Navigate to={isAuthenticated ? `/dashboard${queryString}` : `/login${queryString}`} />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? `/dashboard${queryString}` : `/login${queryString}`} />} />
    </Routes>
  );
}
