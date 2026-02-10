import { useCallback, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';

type DartThrowEvent = {
  playerId: string;
  segment: string;
  score?: number;
  multiplier: number;
};

type TurnEndEvent = {
  playerId: string;
};

interface UseOnlineThrowSyncOptions {
  /**
   * Supabase channel name, e.g. `o1:{gameId}` or `cricket:{gameId}`.
   */
  channelName: string;
  /**
   * The local player's id; used to filter out self events from the subscription.
   */
  localPlayerId: string;
  /**
   * Handler for remote dart throws (never called for the local player's throws).
   */
  onRemoteThrow: (event: DartThrowEvent) => void;
  /**
   * Handler for remote turn end events (never called for the local player's turn end).
   */
  onRemoteTurnEnd: (event: TurnEndEvent) => void;
}

interface UseOnlineThrowSyncReturn {
  sendThrow: (event: DartThrowEvent) => Promise<void>;
  sendTurnEnd: (event: TurnEndEvent) => Promise<void>;
}

/**
 * Shared hook for synchronizing dart throws and turn transitions between players via Supabase channels.
 *
 * This centralizes the realtime wiring so individual game screens only need to provide
 * local handlers and call `sendThrow` / `sendTurnEnd` when appropriate.
 */
export function useOnlineThrowSync(options: UseOnlineThrowSyncOptions): UseOnlineThrowSyncReturn {
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep the latest handlers/ids in refs so the subscription doesn't need to be recreated
  const localPlayerIdRef = useRef(options.localPlayerId);
  const onRemoteThrowRef = useRef(options.onRemoteThrow);
  const onRemoteTurnEndRef = useRef(options.onRemoteTurnEnd);

  localPlayerIdRef.current = options.localPlayerId;
  onRemoteThrowRef.current = options.onRemoteThrow;
  onRemoteTurnEndRef.current = options.onRemoteTurnEnd;

  useEffect(() => {
    const channel = supabase.channel(options.channelName, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'dart_throw' }, ({ payload }) => {
        const event = payload as DartThrowEvent;
        if (event.playerId === localPlayerIdRef.current) return;
        onRemoteThrowRef.current(event);
      })
      .on('broadcast', { event: 'turn_end' }, ({ payload }) => {
        const event = payload as TurnEndEvent;
        if (event.playerId === localPlayerIdRef.current) return;
        onRemoteTurnEndRef.current(event);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, options.channelName]);

  const sendThrow = useCallback(async (event: DartThrowEvent) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'dart_throw',
      payload: event,
    });
  }, []);

  const sendTurnEnd = useCallback(async (event: TurnEndEvent) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'turn_end',
      payload: event,
    });
  }, []);

  return { sendThrow, sendTurnEnd };
}

