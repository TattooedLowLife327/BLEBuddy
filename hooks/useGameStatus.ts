// hooks/useGameStatus.ts
// Handles game status, leave notifications, and disconnect detection

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/client';

const supabase = createClient();

interface UseGameStatusOptions {
  gameId: string;
  localPlayerId: string;
  remotePlayerId: string;
  remotePlayerName: string;
  onOpponentLeft: () => void;
  onOpponentDisconnected?: () => void;
  onOpponentReconnected?: () => void;
}

interface UseGameStatusReturn {
  isOpponentOnline: boolean;
  disconnectCountdown: number | null; // null = not counting, number = seconds left
  leaveMatch: () => Promise<void>;
  opponentLeftMessage: string | null;
}

const DISCONNECT_TIMEOUT_SECONDS = 60;

export function useGameStatus(options: UseGameStatusOptions): UseGameStatusReturn {
  const [isOpponentOnline, setIsOpponentOnline] = useState(false); // Start false until we actually see them
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const [opponentLeftMessage, setOpponentLeftMessage] = useState<string | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const statusChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hasSeenOpponentRef = useRef(false); // Track if we've ever seen opponent online

  // Clear countdown timer
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setDisconnectCountdown(null);
  }, []);

  // Start disconnect countdown
  const startCountdown = useCallback(() => {
    clearCountdown();
    setDisconnectCountdown(DISCONNECT_TIMEOUT_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setDisconnectCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearCountdown();
          // Timeout reached - opponent is gone
          options.onOpponentLeft();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown, options]);

  // Leave match - update DB and broadcast
  const leaveMatch = useCallback(async () => {
    console.log('[GameStatus] Leaving match...');

    // Broadcast leave event to opponent
    if (statusChannelRef.current) {
      await statusChannelRef.current.send({
        type: 'broadcast',
        event: 'game_status',
        payload: {
          type: 'player_left',
          playerId: options.localPlayerId,
          gameId: options.gameId,
        },
      });
    }

    // Update game status in database
    try {
      const { error } = await (supabase as any)
        .schema('companion')
        .from('active_games')
        .update({ status: 'cancelled' })
        .eq('id', options.gameId);

      if (error) console.error('[GameStatus] Error updating game status:', error);
    } catch (err) {
      console.error('[GameStatus] Error updating game status:', err);
    }
  }, [options.gameId, options.localPlayerId]);

  // Setup presence and status channels
  useEffect(() => {
    const channelName = `game:${options.gameId}`;
    console.log(`[GameStatus] Setting up channels for game: ${options.gameId}`);

    // Presence channel for online/offline detection
    presenceChannelRef.current = supabase.channel(`presence:${channelName}`, {
      config: { presence: { key: options.localPlayerId } },
    });

    presenceChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current?.presenceState() || {};
        const onlinePlayerIds = Object.keys(state);
        const opponentOnline = onlinePlayerIds.includes(options.remotePlayerId);

        console.log(`[GameStatus] Presence sync - online players:`, onlinePlayerIds);
        console.log(`[GameStatus] Opponent online: ${opponentOnline}, hasSeenOpponent: ${hasSeenOpponentRef.current}`);

        if (opponentOnline) {
          // Opponent is online - mark as seen and clear any countdown
          if (!hasSeenOpponentRef.current) {
            console.log('[GameStatus] First time seeing opponent online');
            hasSeenOpponentRef.current = true;
          }
          if (!isOpponentOnline) {
            console.log('[GameStatus] Opponent came online/reconnected');
            clearCountdown();
            setIsOpponentOnline(true);
            options.onOpponentReconnected?.();
          }
        } else if (!opponentOnline && hasSeenOpponentRef.current && isOpponentOnline) {
          // Opponent went offline AFTER we previously saw them - start countdown
          console.log('[GameStatus] Opponent disconnected after being online - starting countdown');
          setIsOpponentOnline(false);
          options.onOpponentDisconnected?.();
          startCountdown();
        } else if (!opponentOnline && !hasSeenOpponentRef.current) {
          // Opponent not online but we haven't seen them yet - just waiting
          console.log('[GameStatus] Waiting for opponent to join...');
        }
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log(`[GameStatus] Player joined: ${key}`);
        if (key === options.remotePlayerId) {
          hasSeenOpponentRef.current = true;
          clearCountdown();
          setIsOpponentOnline(true);
          options.onOpponentReconnected?.();
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log(`[GameStatus] Player left presence: ${key}`);
        // Don't immediately mark as offline - let sync handle it
      })
      .subscribe(async (status) => {
        console.log(`[GameStatus] Presence channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          await presenceChannelRef.current?.track({
            online_at: new Date().toISOString(),
            player_id: options.localPlayerId,
          });
        }
      });

    // Status channel for explicit game events (leave, etc)
    statusChannelRef.current = supabase.channel(`status:${channelName}`, {
      config: { broadcast: { self: false } },
    });

    statusChannelRef.current
      .on('broadcast', { event: 'game_status' }, ({ payload }) => {
        console.log('[GameStatus] Received game status event:', payload);

        if (payload.type === 'player_left' && payload.playerId === options.remotePlayerId) {
          // Opponent explicitly left
          console.log('[GameStatus] Opponent explicitly left the match');
          clearCountdown();
          setOpponentLeftMessage(`${options.remotePlayerName} has left the match`);

          // Auto-return to lobby after showing message
          setTimeout(() => {
            options.onOpponentLeft();
          }, 2500);
        }
      })
      .subscribe((status) => {
        console.log(`[GameStatus] Status channel status: ${status}`);
      });

    // Cleanup
    return () => {
      console.log('[GameStatus] Cleaning up channels');
      clearCountdown();
      presenceChannelRef.current?.untrack();
      presenceChannelRef.current?.unsubscribe();
      statusChannelRef.current?.unsubscribe();
    };
  }, [options.gameId, options.localPlayerId, options.remotePlayerId, options.remotePlayerName]);

  return {
    isOpponentOnline,
    disconnectCountdown,
    leaveMatch,
    opponentLeftMessage,
  };
}

export default useGameStatus;
