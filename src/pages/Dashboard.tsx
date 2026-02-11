import { useState } from 'react';
import { ChevronLeft, ChevronRight, Bluetooth, Lock } from 'lucide-react';
import { LobbyCard } from '../components/LobbyCard';
import { AppHeader } from '../components/AppHeader';
import { isDevMode } from '../utils/devMode';
import { LADIES_LOBBY_PASSWORD, YOUTH_LOBBY_PASSWORD } from '../utils/constants';

// Images from public/assets/
const dartsIcon = '/assets/5darts.png';
const ladiesDartIcon = '/assets/ladiesdart.png';
const youthDartIcon = '/assets/youthdart.png';
const localPlayDartIcon = '/assets/playerdart.png';
const cashSetsIcon = '/assets/cashseticon.png';
const tournamentDartIcon = '/assets/elitedart.png';
const leagueDartIcon = '/assets/ghostdart.png';
const youthBackground = '/assets/background.png';

type GameRequestNotification = {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  createdAt: string;
};

interface DashboardProps {
  userId: string;
  isYouthPlayer: boolean;
  hasParentPaired: boolean;
  userRole: string | null;
  userGender: string | null;
  userAge: number | null;
  hasActiveTournament: boolean;
  hasActiveLeague: boolean;
  bleConnected: boolean;
  bleStatus: 'disconnected' | 'scanning' | 'connecting' | 'connected';
  onBLEConnect: () => Promise<{ success: boolean; error?: string }>;
  onBLEDisconnect: () => Promise<void>;
  onNavigateToOnlineLobby: (lobbyType?: 'main' | 'ladies' | 'youth') => void;
  onNavigateToLocalDubs: () => void;
  onNavigateToRemoteDubs: () => void;
  onNavigateToInhouse01: (gameType: '301' | '501' | '701') => void;
  onNavigateToCricket: () => void;
  missedRequests: GameRequestNotification[];
  onClearMissedRequests: () => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export function Dashboard({
  userId,
  isYouthPlayer,
  hasParentPaired,
  userRole,
  userGender,
  userAge,
  hasActiveTournament,
  hasActiveLeague,
  bleConnected,
  bleStatus,
  onBLEConnect,
  onBLEDisconnect,
  onNavigateToOnlineLobby,
  onNavigateToLocalDubs,
  onNavigateToRemoteDubs,
  onNavigateToInhouse01,
  onNavigateToCricket,
  missedRequests,
  onClearMissedRequests,
  onLogout,
  onOpenSettings,
}: DashboardProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [flippingCard, setFlippingCard] = useState<string | null>(null);
  const [showBLEPrompt, setShowBLEPrompt] = useState(false);
  const [unlockedLadies, setUnlockedLadies] = useState(false);
  const [unlockedYouth, setUnlockedYouth] = useState(false);
  const [passwordModalFor, setPasswordModalFor] = useState<'ladies' | 'youth' | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const isAdminTeam = userRole === 'owner' || userRole === 'the_man' || userRole === 'admin' || userRole === 'mod';
  const canAccessLadies = isAdminTeam || userGender === 'female' || unlockedLadies;
  const canAccessYouth = isAdminTeam || isYouthPlayer || unlockedYouth;

  const lobbyCards = [
    {
      id: 'online-play',
      title: 'Online',
      description: 'Solo / Doubles / Remote Doubles',
      customIcon: dartsIcon,
      visible: isAdminTeam || !isYouthPlayer || (isYouthPlayer && hasParentPaired),
      expandable: true,
      accentColor: '#06B6D4',
    },
    {
      id: 'local-play',
      title: 'Local Play',
      description: 'Find players near you',
      customIcon: localPlayDartIcon,
      visible: true,
      accentColor: '#a855f7',
    },
    {
      id: 'tournament',
      title: "Tattoo's Lounge",
      description: 'Join your active tournament',
      customIcon: tournamentDartIcon,
      visible: isAdminTeam || hasActiveTournament,
      accentColor: '#F7931E',
    },
    {
      id: 'league',
      title: 'League Play',
      description: 'Connect to league match',
      customIcon: leagueDartIcon,
      visible: isAdminTeam || hasActiveLeague,
      accentColor: '#8B5CF6',
    },
    {
      id: 'cash-sets',
      title: 'Cash Sets',
      description: '21+ age-gated matches',
      customIcon: cashSetsIcon,
      visible: isAdminTeam || (userAge !== null && userAge >= 21),
      ageGated: true,
      accentColor: '#3FA34D',
    },
    {
      id: 'ladies-only',
      title: 'Ladies Only',
      description: 'Protected access',
      customIcon: ladiesDartIcon,
      visible: isAdminTeam || (!isYouthPlayer && userGender === 'female'),
      protected: true,
      accentColor: '#EC4899',
    },
    {
      id: 'youth-lobby',
      title: 'Youth Lobby',
      description: 'Safe play environment',
      customIcon: youthDartIcon,
      visible: isAdminTeam || isYouthPlayer,
      accentColor: '#84CC16',
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
    if (!bleConnected && !isDevMode()) {
      setShowBLEPrompt(true);
      return;
    }
    onNavigateToOnlineLobby();
  };

  const handleBLEPromptConnect = async () => {
    const result = await onBLEConnect();
    if (result.success) {
      setShowBLEPrompt(false);
      onNavigateToOnlineLobby();
    }
  };

  const handleBLEPromptCancel = () => {
    setShowBLEPrompt(false);
  };

  const handleNavigateFromCard = (cardId?: string) => {
    if (cardId === 'ladies-only') {
      if (!canAccessLadies) {
        setPasswordModalFor('ladies');
        setPasswordInput('');
        setPasswordError('');
        return;
      }
      if (!bleConnected && !isDevMode()) {
        setShowBLEPrompt(true);
        return;
      }
      onNavigateToOnlineLobby('ladies');
      return;
    }
    if (cardId === 'youth-lobby') {
      if (!canAccessYouth) {
        setPasswordModalFor('youth');
        setPasswordInput('');
        setPasswordError('');
        return;
      }
      if (!bleConnected && !isDevMode()) {
        setShowBLEPrompt(true);
        return;
      }
      onNavigateToOnlineLobby('youth');
      return;
    }
    handleNavigateToOnlineLobby();
  };

  const handlePasswordSubmit = () => {
    if (passwordModalFor === 'ladies') {
      if (passwordInput.trim() === LADIES_LOBBY_PASSWORD) {
        setUnlockedLadies(true);
        setPasswordModalFor(null);
        setPasswordInput('');
        setPasswordError('');
        if (!bleConnected && !isDevMode()) {
          setShowBLEPrompt(true);
          return;
        }
        onNavigateToOnlineLobby('ladies');
      } else {
        setPasswordError('Incorrect password');
      }
      return;
    }
    if (passwordModalFor === 'youth') {
      if (passwordInput.trim() === YOUTH_LOBBY_PASSWORD) {
        setUnlockedYouth(true);
        setPasswordModalFor(null);
        setPasswordInput('');
        setPasswordError('');
        if (!bleConnected && !isDevMode()) {
          setShowBLEPrompt(true);
          return;
        }
        onNavigateToOnlineLobby('youth');
      } else {
        setPasswordError('Incorrect password');
      }
    }
  };

  return (
    <div
      className="h-screen w-full overflow-hidden"
      style={{
        background: isYouthPlayer
          ? `url(${youthBackground}) center/cover no-repeat, black`
          : 'black'
      }}
    >
      {showBLEPrompt && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-blue-600 rounded-xl p-6 max-w-sm w-full text-center">
            <Bluetooth className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h2 className="text-white text-lg font-bold mb-2">Connect Your Board</h2>
            <p className="text-zinc-400 text-sm mb-4">
              You must connect to your Granboard before entering the online lobby.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBLEPromptCancel}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBLEPromptConnect}
                disabled={bleStatus === 'connecting' || bleStatus === 'scanning'}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {bleStatus === 'connecting' || bleStatus === 'scanning' ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordModalFor && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border rounded-xl p-6 max-w-sm w-full text-center"
            style={{ borderColor: passwordModalFor === 'ladies' ? '#EC4899' : '#84CC16' }}
          >
            <Lock className="w-12 h-12 mx-auto mb-3" style={{ color: passwordModalFor === 'ladies' ? '#EC4899' : '#84CC16' }} />
            <h2 className="text-white text-lg font-bold mb-2">
              {passwordModalFor === 'ladies' ? 'Ladies Only' : 'Youth Lobby'}
            </h2>
            <p className="text-zinc-400 text-sm mb-4">
              Enter the access code to continue.
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Access code"
              className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent mb-2"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
              autoFocus
            />
            {passwordError && (
              <p className="text-red-400 text-sm mb-2">{passwordError}</p>
            )}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setPasswordModalFor(null); setPasswordInput(''); setPasswordError(''); }}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: passwordModalFor === 'ladies' ? '#EC4899' : '#84CC16',
                }}
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col px-4 sm:px-8 py-4 max-w-[1400px] mx-auto">
        <AppHeader
          title="Dashboard"
          bleConnected={bleConnected}
          bleStatus={bleStatus}
          onBLEConnect={onBLEConnect}
          onBLEDisconnect={onBLEDisconnect}
          missedRequests={missedRequests}
          onClearMissedRequests={onClearMissedRequests}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
        />

        <main className="flex-1 flex flex-col justify-center items-center">
          <div className="relative w-full max-w-[1100px] flex items-center justify-center">
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
                      accentColor={card.accentColor}
                      ageGated={card.ageGated}
                      protected={card.protected}
                      expandable={card.expandable}
                      isCenter={isCenter}
                      isFlipped={isCenter && flippingCard === card.id}
                      onNavigateToSolo={handleNavigateFromCard}
                      onNavigateToLocalDubs={onNavigateToLocalDubs}
                      onNavigateToRemoteDubs={onNavigateToRemoteDubs}
                      onNavigateToInhouse01={onNavigateToInhouse01}
                      onNavigateToCricket={onNavigateToCricket}
                    />
                  </div>
                );
              })}
            </div>

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

          <div className="flex gap-2 mt-6">
            {visibleCards.map((card, index) => (
              <button
                key={card.id}
                onClick={() => {
                  setFlippingCard(null);
                  setCurrentCardIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentCardIndex
                    ? 'bg-purple-500 scale-125'
                    : 'bg-zinc-600 hover:bg-zinc-500'
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

export default Dashboard;
