// hooks/useBLEThrows.ts
// Hook to sync BLE throws with Supabase companion.game_throws table

import { useState, useEffect, useCallback } from 'react';
import bleConnection, { DartThrowData } from '../utils/ble/bleConnection';
import { createClient } from '../utils/supabase/client';

// Matches companion.game_throws schema
interface GameThrowRecord {
  id: string;
  game_id: string;
  player_id: string;
  dart_num: number;
  segment: string;
  score: number;
  multiplier: number;
  base_value: number;
  running_total: number;
  leg_num: number;
  created_at: string;
}

interface SaveThrowParams {
  throwData: DartThrowData;
  runningTotal: number;
  legNum?: number;
}

interface UseBLEThrowsReturn {
  throws: GameThrowRecord[];
  allThrows: GameThrowRecord[];
  isProcessing: boolean;
  error: string | null;
  saveThrow: (params: SaveThrowParams) => Promise<GameThrowRecord | null>;
  reloadThrows: () => Promise<void>;
}

export function useBLEThrows(gameId?: string, playerId?: string): UseBLEThrowsReturn {
  const [throws, setThrows] = useState<GameThrowRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Save throw to companion.game_throws
  const saveThrowToDatabase = useCallback(async (params: SaveThrowParams): Promise<GameThrowRecord | null> => {
    const { throwData, runningTotal, legNum = 1 } = params;

    if (!gameId || !playerId) {
      console.warn('[useBLEThrows] No game or player ID - skipping database save');
      return null;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const { data, error: dbError } = await (supabase as any)
        .schema('companion')
        .from('game_throws')
        .insert({
          game_id: gameId,
          player_id: playerId,
          dart_num: throwData.dartNum,
          segment: throwData.segment,
          score: throwData.score,
          multiplier: throwData.multiplier || 1,
          base_value: throwData.baseValue,
          running_total: runningTotal,
          leg_num: legNum,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ [useBLEThrows] Throw saved to companion.game_throws:', data);

      // Add to local state
      setThrows(prev => [...prev, data as GameThrowRecord]);

      return data as GameThrowRecord;

    } catch (err) {
      console.error('❌ [useBLEThrows] Error saving throw:', err);
      setError((err as Error).message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [gameId, playerId, supabase]);

  // Load existing throws from database for this game
  const loadGameThrows = useCallback(async () => {
    if (!gameId) return;

    try {
      const { data, error: fetchError } = await (supabase as any)
        .schema('companion')
        .from('game_throws')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setThrows((data as GameThrowRecord[]) || []);
      console.log(`📊 [useBLEThrows] Loaded ${data?.length || 0} throws for game ${gameId}`);

    } catch (err) {
      console.error('[useBLEThrows] Error loading throws:', err);
      setError((err as Error).message);
    }
  }, [gameId, supabase]);

  // Load throws on mount and when gameId changes
  useEffect(() => {
    if (gameId) {
      loadGameThrows();
    }
  }, [gameId, loadGameThrows]);

  // Get throws for current player only
  const playerThrows = throws.filter(t => t.player_id === playerId);

  return {
    throws: playerThrows,
    allThrows: throws,
    isProcessing,
    error,
    saveThrow: saveThrowToDatabase,
    reloadThrows: loadGameThrows
  };
}

export default useBLEThrows;
