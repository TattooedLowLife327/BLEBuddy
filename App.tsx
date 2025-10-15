import { useState, useEffect, useRef } from 'react';
import { LobbyCard } from './components/LobbyCard';
import { Login } from './components/Login';
import { OnlineLobby } from './components/OnlineLobby';
import { LocalDubsSetup } from './components/LocalDubsSetup';
import { RemoteDubsSetup } from './components/RemoteDubsSetup';
import { Badge } from './components/ui/badge';
import { UserMenu } from './components/UserMenu';
import {
  MapPin,
  Wifi,
  Trophy,
  Users,
  DollarSign,
  Baby,
  Heart,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { createClient } from './utils/supabase/client';
import { useBLE } from './contexts/BLEContext';
import bluetoothIcon from './dashboardicon.png';

import dartsIcon from './5darts.png';
import ladiesDartIcon from './ladiesdart.png';
import youthDartIcon from './youthdart.png';
import localPlayDartIcon from './playerdart.png';
import cashSetsIcon from './cashseticon.png';
import tournamentDartIcon from './elitedart.png';
import leagueDartIcon from './ghostdart.png';

type GameRequestNotification = {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  createdAt: string;
  schema: 'player' | 'youth';
};

export default function App() {
  const { isConnected: bleConnected, connect: bleConnect, disconnect: bleDisconnect, status: bleStatus } = useBLE();
  const [accentColor, setAccentColor] = useState('#a855f7'); // Default purple accent
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
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [flippingCard, setFlippingCard] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'lobby' | 'online-lobby' | 'local-dubs-setup' | 'remote-dubs-setup'>('lobby');
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [doublesPartner, setDoublesPartner] = useState<{id: string; name: string} | null>(null);
  const [missedRequests, setMissedRequests] = useState<GameRequestNotification[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const supabase = createClient();
  const scrollContainerRef = useState<HTMLDivElement | null>(null)[0];
  const currentViewRef = useRef(currentView);

  // Check authentication and fetch user's profile data from Supabase
  useEffect(() => {
    async function checkAuthAndFetchProfile() {
      try {
        console.log('Starting auth check...');
        
        // Get the current user's session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Session result:', { hasSession: !!session, error: sessionError });
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          console.log('User authenticated:', session.user.id);
          setIsAuthenticated(true);
          setUserId(session.user.id);
          
          try {
            // Fetch profile color and profile pic - try player schema first, then youth schema
            console.log('Fetching profile for user ID:', session.user.id);
            
            // Try player.player_profiles first (schema is set to 'player' by default in client config)
            const { data: playerData, error: playerError } = await supabase
              .from('player_profiles')
              .select('profilecolor, profilepic, role, gender, birthday_month, birthday_day, birthday_year, granboard_name')
              .eq('id', session.user.id)
              .single();

            let profileData = playerData;
            let profileError = playerError;

            // If not found in player schema, try youth.youth_profiles
            if (playerError || !playerData) {
              console.log('Player profile not found, checking youth schema...');
              const { data: youthData, error: youthError } = await supabase
                .schema('youth')
                .from('youth_profiles')
                .select('profilecolor, profilepic, role, gender, birthday_month, birthday_day, birthday_year, parent_id, granboard_name')
                .eq('id', session.user.id)
                .single();

              if (youthData) {
                console.log('Found youth profile!');
                profileData = youthData;
                profileError = youthError;
                setIsYouthPlayer(true);
                
                // Check if youth player has parent paired
                if (youthData.parent_id) {
                  console.log('Youth player has parent paired');
                  setHasParentPaired(true);
                }
              }
            }

            // Set user name
            if (profileData?.granboard_name) {
              setUserName(profileData.granboard_name);
            }

            // Set user role if available
            if (profileData?.role) {
              console.log('Setting user role:', profileData.role);
              setUserRole(profileData.role);
            }

            // Set user gender if available
            if (profileData?.gender) {
              console.log('Setting user gender:', profileData.gender);
              setUserGender(profileData.gender);
            }

            // Calculate user age if birthday fields are available
            if (profileData?.birthday_year && profileData?.birthday_month && profileData?.birthday_day) {
              const birthDate = new Date(
                profileData.birthday_year,
                profileData.birthday_month - 1, // JavaScript months are 0-indexed
                profileData.birthday_day
              );
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              console.log('Calculated user age:', age);
              setUserAge(age);
            }

            // Check for active tournament registration in tournament schema
            try {
              const { data: tournamentData, error: tournamentError } = await supabase
                .schema('tournament')
                .from('tournament_registrations')
                .select('id')
                .eq('player_id', session.user.id)
                .eq('status', 'active')
                .limit(1);
              
              if (tournamentData && tournamentData.length > 0) {
                console.log('User has active tournament registration');
                setHasActiveTournament(true);
              }
            } catch (err) {
              console.log('Error checking tournament status:', err);
            }

            // Check for active league match schedule in league schema
            try {
              const { data: leagueData, error: leagueError } = await supabase
                .schema('league')
                .from('league_schedules')
                .select('id')
                .eq('player_id', session.user.id)
                .eq('status', 'scheduled')
                .limit(1);
              
              if (leagueData && leagueData.length > 0) {
                console.log('User has active league match');
                setHasActiveLeague(true);
              }
            } catch (err) {
              console.log('Error checking league status:', err);
            }

            console.log('Profile data received:', profileData);
            console.log('Profile fetch error:', profileError);

            if (profileData?.profilecolor) {
              console.log('Setting accent color:', profileData.profilecolor);
              setAccentColor(profileData.profilecolor);
            }

            if (profileData?.profilepic) {
              console.log('Profile pic data from database:', profileData.profilepic);
              
              // Check if it's already a full URL or a storage path
              if (profileData.profilepic.startsWith('http')) {
                // Already a full URL
                console.log('Using direct URL for profile pic');
                setProfilePic(profileData.profilepic);
              } else {
                // It's a storage path in the 'profilepic' bucket
                // Structure: profilepic/player/{id}/filename or profilepic/youth/{id}/filename
                const bucketName = 'profilepic';
                
                const { data: urlData } = supabase
                  .storage
                  .from(bucketName)
                  .getPublicUrl(profileData.profilepic);
                
                console.log(`Generated profile pic URL from bucket "${bucketName}":`, urlData.publicUrl);
                console.log('Full storage path:', profileData.profilepic);
                setProfilePic(urlData.publicUrl);
              }
            }

            if (profileError && !profileData) {
              console.error('Error fetching profile data:', profileError);
            }
          } catch (profileFetchError) {
            console.error('Error during profile fetch:', profileFetchError);
            // Continue anyway - we're authenticated even if profile fetch fails
          }
        } else {
          console.log('No active session found');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error in checkAuthAndFetchProfile:', error);
        setIsAuthenticated(false);
      } finally {
        console.log('Auth check complete, setting loading to false');
        setLoading(false);
      }
    }

    checkAuthAndFetchProfile();
  }, []);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      setIsAuthenticated(false);
      setUserId('');
      setUserName('');
      setProfilePic(null);
      setAccentColor('#a855f7');
      setDoublesPartner(null);
      setIsYouthPlayer(false);
      setUserRole(null);
      setUserGender(null);
      setUserAge(null);
      setHasActiveLeague(false);
      setHasActiveTournament(false);
      setHasParentPaired(false);
      setCurrentView('lobby');
      setMissedRequests([]);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return;
    }

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
            if (currentViewRef.current === 'online-lobby') {
              return;
            }

            const data = payload.new as Record<string, any>;
            const challengerId = data.player1_id as string | undefined;
            if (!challengerId) return;

            const notificationId = `${schema}-${data.id}`;
            let challengerName = 'Opponent';

            try {
              const profileQuery =
                schema === 'youth'
                  ? supabase.schema('youth').from('youth_profiles')
                  : supabase.from('player_profiles');

              const { data: profile } = await profileQuery
                .select('granboard_name')
                .eq('id', challengerId)
                .single();

              if (profile?.granboard_name) {
                challengerName = profile.granboard_name;
              }
            } catch (error) {
              console.error('Error fetching challenger name:', error);
            }

            setMissedRequests(prev => {
              if (prev.some(notification => notification.id === notificationId)) {
                return prev;
              }

              return [
                ...prev,
                {
                  id: notificationId,
                  fromPlayerId: challengerId,
                  fromPlayerName: challengerName,
                  createdAt: data.created_at || new Date().toISOString(),
                  schema,
                },
              ];
            });
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [isAuthenticated, userId, supabase]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Reload the page to fetch profile data
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Check if user is admin team (can see all cards)
  const isAdminTeam = userRole === 'owner' || userRole === 'the_man' || userRole === 'admin' || userRole === 'mod';

  const lobbyCards = [
    {
      id: 'online-play',
      title: 'Online',
      description: 'Solo / Doubles / Remote Doubles',
      customIcon: dartsIcon,
      visible: isAdminTeam || !isYouthPlayer, // not visible to youth
      expandable: true,
      accentColor: '#06B6D4', // cyan
    },
    {
      id: 'local-play',
      title: 'Local Play',
      description: 'Find players near you',
      customIcon: localPlayDartIcon,
      visible: true, // visible to all
      accentColor: '#a855f7', // purple
    },
    {
      id: 'tournament',
      title: "Tattoo's Lounge",
      description: 'Join your active tournament',
      customIcon: tournamentDartIcon,
      visible: isAdminTeam || hasActiveTournament, // only when active tournament or admin team
      accentColor: '#F7931E', // orange
    },
    {
      id: 'league',
      title: 'League Play',
      description: 'Connect to league match',
      customIcon: leagueDartIcon,
      visible: isAdminTeam || hasActiveLeague, // only when active league match or admin team
      accentColor: '#8B5CF6', // violet
    },
    {
      id: 'cash-sets',
      title: 'Cash Sets',
      description: '21+ age-gated matches',
      customIcon: cashSetsIcon,
      visible: isAdminTeam || (userAge !== null && userAge >= 21), // admin team or 21+ users
      ageGated: true,
      accentColor: '#3FA34D', // green
    },
    {
      id: 'ladies-only',
      title: 'Ladies Only',
      description: 'Protected access',
      customIcon: ladiesDartIcon,
      visible: isAdminTeam || userGender === 'female', // only female accounts or admin team
      protected: true,
      accentColor: '#EC4899', // pink
    },
    {
      id: 'youth-lobby',
      title: 'Youth Lobby',
      description: 'Safe play environment',
      customIcon: youthDartIcon,
      visible: isAdminTeam || isYouthPlayer, // admin team or youth players only
      accentColor: '#84CC16', // lime
    },
  ];

  const visibleCards = lobbyCards.filter(card => card.visible);

  const prevCard = () => {
    if (flippingCard) {
      setFlippingCard(null);
      setTimeout(() => {
        setCurrentCardIndex((prev) => (prev - 1 + visibleCards.length) % visibleCards.length);
      }, 250);
    } else {
      setCurrentCardIndex((prev) => (prev - 1 + visibleCards.length) % visibleCards.length);
    }
  };

  const nextCard = () => {
    if (flippingCard) {
      setFlippingCard(null);
      setTimeout(() => {
        setCurrentCardIndex((prev) => (prev + 1) % visibleCards.length);
      }, 250);
    } else {
      setCurrentCardIndex((prev) => (prev + 1) % visibleCards.length);
    }
  };

  const handleCardClick = (cardId: string) => {
    if (flippingCard === cardId) {
      setFlippingCard(null);
    } else {
      setFlippingCard(cardId);
    }
  };

  const handleNavigateToOnlineLobby = () => {
    setCurrentView('online-lobby');
  };

  const handleNavigateToLocalDubs = () => {
    setCurrentView('local-dubs-setup');
  };

  const handleNavigateToRemoteDubs = () => {
    setCurrentView('remote-dubs-setup');
  };

  const handleBackToLobby = () => {
    setCurrentView('lobby');
    setDoublesPartner(null);
  };

  const handleLocalDubsContinue = async (partnerId: string, userGoesFirst: boolean) => {
    // Fetch partner name
    try {
      const { data: partnerData } = await supabase
        .from('player_profiles')
        .select('granboard_name')
        .eq('id', partnerId)
        .single();

      if (!partnerData) {
        const { data: youthPartnerData } = await supabase
          .schema('youth')
          .from('youth_profiles')
          .select('granboard_name')
          .eq('id', partnerId)
          .single();

        if (youthPartnerData) {
          setDoublesPartner({ id: partnerId, name: youthPartnerData.granboard_name });
        }
      } else {
        setDoublesPartner({ id: partnerId, name: partnerData.granboard_name });
      }
    } catch (err) {
      console.error('Error fetching partner:', err);
    }

    setCurrentView('online-lobby');
  };

  const handleRemoteDubsContinue = async (partnerId: string) => {
    // Fetch partner name
    try {
      const { data: partnerData } = await supabase
        .from('player_profiles')
        .select('granboard_name')
        .eq('id', partnerId)
        .single();

      if (partnerData) {
        setDoublesPartner({ id: partnerId, name: partnerData.granboard_name });
      }
    } catch (err) {
      console.error('Error fetching partner:', err);
    }

    setCurrentView('online-lobby');
  };

  // Render different views based on currentView
  if (currentView === 'online-lobby') {
    return (
      <OnlineLobby
        onBack={handleBackToLobby}
        accentColor={accentColor}
        userId={userId}
        isYouthPlayer={isYouthPlayer}
        hasParentPaired={hasParentPaired}
        isDoublesTeam={doublesPartner !== null}
        partnerId={doublesPartner?.id}
        partnerName={doublesPartner?.name}
        profilePic={profilePic}
        userName={userName}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'local-dubs-setup') {
    return (
      <LocalDubsSetup
        onBack={handleBackToLobby}
        onContinue={handleLocalDubsContinue}
        accentColor={accentColor}
        userId={userId}
        userProfilePic={profilePic}
        userName={userName}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'remote-dubs-setup') {
    return (
      <RemoteDubsSetup
        onBack={handleBackToLobby}
        onContinue={handleRemoteDubsContinue}
        accentColor={accentColor}
        userId={userId}
        userProfilePic={profilePic}
        userName={userName}
        onLogout={handleLogout}
      />
    );
  }

  const notificationCount = missedRequests.length;

  return (
    <div 
      className="h-screen w-full overflow-hidden"
      style={{
        background: isYouthPlayer 
          ? `url(${youthBackground}) center/cover no-repeat, black`
          : 'black'
      }}
    >

      {/* Main Content */}
      <div className="relative z-10 h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="p-6 pb-4">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto">
            {/* BLE Connection Status - Top Left */}
            <button
              onClick={async () => {
                if (bleConnected) {
                  await bleDisconnect();
                } else {
                  const result = await bleConnect();
                  if (!result.success && result.error) {
                    alert(`BLE Connection Failed:\n\n${result.error}\n\nTroubleshooting:\n- Make sure your Granboard is powered on\n- Enable Bluetooth on your phone\n- Use Chrome or Edge browser\n- Make sure you're using HTTPS (deployed app) or localhost`);
                  }
                }
              }}
              className="flex items-center gap-3 transition-all hover:scale-105"
              disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
            >
              <img
                src={bluetoothIcon}
                alt="BLE Status"
                className="w-8 h-8 object-contain transition-all duration-300"
                style={{
                  filter: bleConnected
                    ? 'brightness(0) saturate(100%) invert(64%) sepia(98%) saturate(451%) hue-rotate(85deg) brightness(95%) contrast(89%)'
                    : bleStatus === 'connecting' || bleStatus === 'scanning'
                    ? 'brightness(0) saturate(100%) invert(73%) sepia(47%) saturate(1122%) hue-rotate(358deg) brightness(103%) contrast(96%)'
                    : 'brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(4392%) hue-rotate(352deg) brightness(93%) contrast(94%)'
                }}
              />
              <span
                className="transition-colors text-sm"
                style={{
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  color: bleConnected ? '#10b981' : bleStatus === 'connecting' || bleStatus === 'scanning' ? '#f59e0b' : '#ef4444'
                }}
              >
                {bleStatus === 'connected' ? 'Connected' :
                 bleStatus === 'connecting' ? 'Connecting...' :
                 bleStatus === 'scanning' ? 'Scanning...' :
                 'Disconnected'}
              </span>
            </button>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative p-2 rounded-full border border-white/10 text-white hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    aria-label={notificationCount ? `${notificationCount} missed requests` : 'No missed requests'}
                  >
                    <Bell className="w-5 h-5" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[240px] bg-zinc-900/95 text-white border border-zinc-700 backdrop-blur-md"
                >
                  <DropdownMenuLabel>Missed Requests</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  {notificationCount === 0 ? (
                    <DropdownMenuItem disabled className="text-zinc-400">
                      No missed requests
                    </DropdownMenuItem>
                  ) : (
                    <>
                      {missedRequests.map(request => (
                        <DropdownMenuItem
                          key={request.id}
                          className="focus:bg-zinc-800 focus:text-white cursor-default"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{request.fromPlayerName}</span>
                            <span className="text-xs text-zinc-400">
                              {new Date(request.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="bg-zinc-700" />
                      <DropdownMenuItem
                        onSelect={event => {
                          event.preventDefault();
                          setMissedRequests([]);
                        }}
                        className="focus:bg-red-500/20 focus:text-white text-red-400 cursor-pointer"
                      >
                        Clear all
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <UserMenu
                profilePic={profilePic}
                accentColor={accentColor}
                userName={userName}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        {/* Lobby Cards Carousel */}
        <main className="flex-1 px-6 pb-6 flex flex-col justify-center">
          <div className="relative">
            {/* Left Chevron */}
            <button
              onClick={prevCard}
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20
              }}
              className="p-3 text-white hover:text-purple-400 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-8 h-8" strokeWidth={2} />
            </button>

            {/* Cards - Show 3: prev, current, next */}
            <div className="flex justify-center items-center space-x-4 overflow-visible">
              {[-1, 0, 1].map(offset => {
                const index = (currentCardIndex + offset + visibleCards.length) % visibleCards.length;
                const card = visibleCards[index];
                const isCenter = offset === 0;

                return (
                  <div
                    key={`slot-${offset}`}
                    onClick={() => isCenter && handleCardClick(card.id)}
                    className={`transition-all duration-300 ${
                      isCenter ? 'cursor-pointer z-10' : 'cursor-default z-0'
                    }`}
                    style={{
                      transform: isCenter
                        ? 'translateY(0) scale(1)'
                        : 'translateY(6px) scale(0.88)',
                      filter: isCenter ? 'none' : 'grayscale(0.6) brightness(0.85)',
                      opacity: isCenter ? 1 : 0.8,
                      perspective: '1000px',
                      transition:
                        'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), filter 250ms ease, opacity 250ms ease',
                      willChange: 'transform, filter, opacity',
                    }}
                  >
                    <LobbyCard
                      id={card.id}
                      title={card.title}
                      description={card.description}
                      icon={'icon' in card ? card.icon : undefined}
                      customIcon={'customIcon' in card ? card.customIcon : undefined}
                      accentColor={card.accentColor || accentColor}
                      ageGated={card.ageGated}
                      protected={card.protected}
                      expandable={card.expandable}
                      isCenter={isCenter}
                      isFlipped={isCenter && flippingCard === card.id}
                      onNavigateToSolo={handleNavigateToOnlineLobby}
                      onNavigateToLocalDubs={handleNavigateToLocalDubs}
                      onNavigateToRemoteDubs={handleNavigateToRemoteDubs}
                    />
                  </div>
                );
              })}
            </div>

            {/* Right Chevron */}
            <button
              onClick={nextCard}
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20
              }}
              className="p-3 text-white hover:text-purple-400 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-8 h-8" strokeWidth={2} />
            </button>
          </div>

          {/* Pagination dots */}
          <div className="flex justify-center mt-6 space-x-2">
            {visibleCards.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (flippingCard) {
                    setFlippingCard(null);
                    setTimeout(() => {
                      setCurrentCardIndex(index);
                    }, 250);
                  } else {
                    setCurrentCardIndex(index);
                  }
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentCardIndex === index
                    ? 'bg-purple-500'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
