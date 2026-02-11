// contexts/GameContext.tsx
// Game Context Provider for app-wide game state management

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { GameConfiguration } from '../types/game';

// Types
export type GameMode = 'solo' | 'localDubs' | 'remoteDubs' | null;

export interface Partner {
  id: string;
  name: string;
  profilePic?: string;
}

export interface GameData {
  gameId: string;
  opponentId: string;
  opponentName: string;
  opponentProfilePic?: string;
  opponentAccentColor: string;
  isInitiator: boolean;
  gameType?: string | null;
  gameConfig?: GameConfiguration | null;
  corkWinnerId?: string | null;
}

export interface PendingRejoinGame {
  gameId: string;
  opponentId: string;
  opponentName: string;
  isInitiator: boolean;
  gameType?: string | null;
  gameConfig?: GameConfiguration | null;
  corkWinnerId?: string | null;
}

interface GameContextType {
  // Game mode
  mode: GameMode;
  setMode: (mode: GameMode) => void;

  // Partner (for doubles)
  partner: Partner | null;
  setPartner: (partner: Partner | null) => void;

  // Active game
  activeGame: GameData | null;
  setActiveGame: (game: GameData | null | ((prev: GameData | null) => GameData | null)) => void;

  // Pending rejoin
  pendingRejoinGame: PendingRejoinGame | null;
  setPendingRejoinGame: (game: PendingRejoinGame | null) => void;

  // Helper to clear all game state
  clearGameState: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  // Initialize activeGame from sessionStorage (persists across refresh)
  const [activeGame, setActiveGameState] = useState<GameData | null>(() => {
    const saved = sessionStorage.getItem('blebuddy_game');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [mode, setMode] = useState<GameMode>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [pendingRejoinGame, setPendingRejoinGame] = useState<PendingRejoinGame | null>(null);

  // Persist activeGame to sessionStorage
  useEffect(() => {
    if (activeGame) {
      sessionStorage.setItem('blebuddy_game', JSON.stringify(activeGame));
    } else {
      sessionStorage.removeItem('blebuddy_game');
    }
  }, [activeGame]);

  const setActiveGame = (gameOrUpdater: GameData | null | ((prev: GameData | null) => GameData | null)) => {
    setActiveGameState((prev) =>
      typeof gameOrUpdater === 'function' ? gameOrUpdater(prev) : gameOrUpdater
    );
  };

  const clearGameState = () => {
    setMode(null);
    setPartner(null);
    setActiveGameState(null);
    setPendingRejoinGame(null);
    sessionStorage.removeItem('blebuddy_game');
  };

  const value: GameContextType = {
    mode,
    setMode,
    partner,
    setPartner,
    activeGame,
    setActiveGame,
    pendingRejoinGame,
    setPendingRejoinGame,
    clearGameState,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Custom hook to use Game context
export function useGame(): GameContextType {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export default GameContext;
