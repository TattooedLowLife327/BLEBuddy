// Example: How to use BLE in your lobby/match components

import React, { useState, useEffect } from 'react';
import BLEStatus from './components/BLEStatus';
import { useBLEThrows } from './hooks/useBLEThrows';
import { supabase } from './lib/supabaseClient';

// Example Match Component
export function MatchScreen() {
  const [currentMatch, setCurrentMatch] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);

  // Use the BLE throws hook
  const { 
    throws, 
    totalScore, 
    isProcessing, 
    error 
  } = useBLEThrows(
    currentMatch?.id, 
    currentPlayer?.id
  );

  useEffect(() => {
    loadCurrentMatch();
  }, []);

  const loadCurrentMatch = async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get player profile
    const { data: profile } = await supabase
      .schema('player')
      .from('player_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setCurrentPlayer(profile);

    // Get active match
    const { data: match } = await supabase
      .schema('tournaments')
      .from('matches')
      .select('*')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .eq('status', 'active')
      .single();

    setCurrentMatch(match);
  };

  const handleThrowDetected = (throwData) => {
    console.log('🎯 Throw detected in match screen:', throwData);
    // Additional UI updates can go here
    // The useBLEThrows hook already saves to database
  };

  return (
    <div className="match-screen">
      <h1>Live Match</h1>

      {/* BLE Connection Status */}
      <BLEStatus onThrowDetected={handleThrowDetected} />

      {/* Match Info */}
      {currentMatch ? (
        <div className="match-info">
          <h2>Match #{currentMatch.id}</h2>
          <p>Status: {currentMatch.status}</p>
        </div>
      ) : (
        <div className="no-match">
          <p>No active match. Join a lobby first!</p>
        </div>
      )}

      {/* Score Display */}
      <div className="score-display">
        <h3>Your Score: {totalScore}</h3>
        {isProcessing && <p>Processing throw...</p>}
        {error && <p className="error">Error: {error}</p>}
      </div>

      {/* Recent Throws */}
      <div className="throws-list">
        <h3>Recent Throws</h3>
        {throws.slice(-5).reverse().map((throwData) => (
          <div key={throwData.id} className="throw-item">
            <span>{throwData.segment || `${throwData.score} pts`}</span>
            <span>{throwData.multiplier > 1 && `x${throwData.multiplier}`}</span>
            <span className="timestamp">
              {new Date(throwData.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example: Simple integration in any component
export function SimpleBLEExample() {
  const [lastThrow, setLastThrow] = useState(null);

  return (
    <div>
      <h2>Simple BLE Example</h2>
      
      {/* Just add the BLE status component */}
      <BLEStatus 
        onThrowDetected={(throwData) => {
          setLastThrow(throwData);
          console.log('Throw:', throwData);
        }} 
      />

      {lastThrow && (
        <div>
          <h3>Last Throw:</h3>
          <pre>{JSON.stringify(lastThrow, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default MatchScreen;
