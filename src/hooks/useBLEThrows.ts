// hooks/useBLEThrows.ts
// Hook to sync BLE throws with Supabase database

import { useState, useEffect, useCallback } from 'react';
import bleConnection, { DartThrowData } from '../utils/ble/bleConnection';
import { createClient } from '../utils/supabase/client';

interface ThrowRecord extends DartThrowData {
  id: string;
  match_id: string;
  player_id: string;
  created_at?: string;
}

interface UseBLEThrowsReturn {
  throws: ThrowRecord[];
  allThrows: ThrowRecord[];
  totalScore: number;
  isProcessing: boolean;
  error: string | null;
  saveThrow: (throwData: DartThrowData) => Promise<ThrowRecord | null>;
  reloadThrows: () => Promise<void>;
}

export function useBLEThrows(matchId?: string, playerId?: string): UseBLEThrowsReturn {
  const [throws, setThrows] = useState<ThrowRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Save throw to Supabase
  const saveThrowToDatabase = useCallback(async (throwData: DartThrowData): Promise<ThrowRecord | null> => {
    if (!matchId || !playerId) {
      console.warn('No match or player ID - skipping database save');
      return null;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .schema('tournament')
        .from('throws')
        .insert({
          match_id: matchId,
          player_id: playerId,
          score: throwData.score,
          multiplier: throwData.multiplier || 1,
          segment: throwData.segment,
          dart_num: throwData.dartNum,
          coordinates: throwData.coordinates || { x: 0, y: 0 },
          timestamp: throwData.timestamp || new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ Throw saved to database:', data);

      // Add to local state
      setThrows(prev => [...prev, data as ThrowRecord]);

      return data as ThrowRecord;

    } catch (err) {
      console.error('❌ Error saving throw:', err);
      setError((err as Error).message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [matchId, playerId, supabase]);

  // Load existing throws from database
  const loadMatchThrows = useCallback(async () => {
    if (!matchId) return;

    try {
      const { data, error: fetchError } = await supabase
        .schema('tournament')
        .from('throws')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });

      if (fetchError) throw fetchError;

      setThrows((data as ThrowRecord[]) || []);
      console.log(`📊 Loaded ${data?.length || 0} throws for match`);

    } catch (err) {
      console.error('Error loading throws:', err);
      setError((err as Error).message);
    }
  }, [matchId, supabase]);

  // Listen for BLE throws and save them
  useEffect(() => {
    const handleThrow = async (throwData: DartThrowData) => {
      console.log('🎯 New throw detected:', throwData);
      await saveThrowToDatabase(throwData);
    };

    bleConnection.onThrow(handleThrow);

    // Load existing throws for this match
    if (matchId) {
      loadMatchThrows();
    }

    // Cleanup
    return () => {
      bleConnection.offThrow(handleThrow);
    };
  }, [matchId, playerId, saveThrowToDatabase, loadMatchThrows]);

  // Get throws for current player only
  const playerThrows = throws.filter(t => t.player_id === playerId);

  // Calculate total score
  const totalScore = playerThrows.reduce((sum, t) => sum + t.score, 0);

  return {
    throws: playerThrows,
    allThrows: throws,
    totalScore,
    isProcessing,
    error,
    saveThrow: saveThrowToDatabase,
    reloadThrows: loadMatchThrows
  };
}

export default useBLEThrows;
