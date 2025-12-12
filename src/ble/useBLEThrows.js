/* eslint-env browser */
// hooks/useBLEThrows.js
// Hook to sync BLE throws with Supabase database

import { useState, useEffect, useCallback } from 'react';
import bleConnection from './bleConnection';
import { createClient } from '../utils/supabase/client';

const supabase = createClient();

export function useBLEThrows(matchId, playerId) {
  const [throws, setThrows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Save throw to Supabase
  const saveThrowToDatabase = useCallback(async (throwData) => {
    if (!matchId || !playerId) {
      console.warn('No match or player ID - skipping database save');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .schema('tournaments')
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
      setThrows(prev => [...prev, data]);
      
      return data;

    } catch (err) {
      console.error('❌ Error saving throw:', err);
      setError(err.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [matchId, playerId]);

  // Listen for BLE throws and save them
  useEffect(() => {
    const handleThrow = async (throwData) => {
      console.log('🎯 New throw detected:', throwData);
      await saveThrowToDatabase(throwData);
    };

    bleConnection.onThrow(handleThrow);

    // Load existing throws for this match
    if (matchId) {
      loadMatchThrows();
    }

    // Cleanup is not needed since bleConnection is a singleton
    // But we could add a cleanup function if we implement unsubscribe

  }, [matchId, playerId, saveThrowToDatabase]);

  // Load existing throws from database
  const loadMatchThrows = async () => {
    if (!matchId) return;

    try {
      const { data, error: fetchError } = await supabase
        .schema('tournaments')
        .from('throws')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });

      if (fetchError) throw fetchError;

      setThrows(data || []);
      console.log(`📊 Loaded ${data?.length || 0} throws for match`);

    } catch (err) {
      console.error('Error loading throws:', err);
      setError(err.message);
    }
  };

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
