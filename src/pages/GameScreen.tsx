import { useMemo } from 'react';

type Player = {
  id: string;
  name: string;
  score: number;
  sets: number;
  legs: number;
  averages: {
    ppr: number;
    mpr: number;
  };
  accent: string;
  status: 'throwing' | 'waiting';
};

type Visit = {
  playerId: string;
  darts: string;
  score: number;
  note?: string;
};

// Lightweight, static preview of the in-match HUD shown after cork.
// No live data yet—this is for layout approval.
export function GameScreen() {
  const players: Player[] = useMemo(
    () => [
      {
        id: 'me',
        name: 'You',
        score: 501,
        sets: 1,
        legs: 2,
        averages: { ppr: 78.4, mpr: 3.1 },
        accent: '#a855f7',
        status: 'throwing',
      },
      {
        id: 'opp',
        name: 'Opponent',
        score: 524,
        sets: 0,
        legs: 1,
        averages: { ppr: 72.3, mpr: 2.8 },
        accent: '#06b6d4',
        status: 'waiting',
      },
    ],
    []
  );

  const visits: Visit[] = useMemo(
    () => [
      { playerId: 'me', darts: 'T20 T20 D12', score: 156 },
      { playerId: 'opp', darts: 'T19 T18 S12', score: 123 },
      { playerId: 'me', darts: 'T20 T20 T19', score: 177, note: 'Maximum' },
      { playerId: 'opp', darts: 'S20 S20 T5', score: 65 },
    ],
    []
  );

  const currentPlayer = players.find(p => p.status === 'throwing') || players[0];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-zinc-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Match header */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">01 Match</div>
            <div className="text-lg font-semibold">501 • First to 2 Legs</div>
            <span className="text-sm text-zinc-500">Online Play</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Round 5</span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Throws: 3 / 3</span>
          </div>
        </div>

        {/* Score panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {players.map(player => (
            <div
              key={player.id}
              className={`relative rounded-2xl p-5 border ${
                player.id === currentPlayer.id ? 'border-white/30' : 'border-white/10'
              }`}
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                boxShadow:
                  player.id === currentPlayer.id
                    ? `0 0 25px ${player.accent}55`
                    : 'none',
              }}
            >
              {player.id === currentPlayer.id && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${player.accent}40`,
                  }}
                />
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-10 rounded-full"
                    style={{ backgroundColor: player.accent }}
                  />
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                      {player.status === 'throwing' ? 'Throwing' : 'Waiting'}
                    </div>
                    <div className="text-xl font-bold">{player.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black leading-none">{player.score}</div>
                  <div className="text-xs text-zinc-400">Score</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                    Sets: {player.sets}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                    Legs: {player.legs}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs">PPR: {player.averages.ppr.toFixed(1)}</span>
                  <span className="text-xs">MPR: {player.averages.mpr.toFixed(1)}</span>
                </div>
              </div>

              {/* Checkout banner */}
              <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2 bg-white/5 border border-white/10">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Checkout</div>
                <div className="text-lg font-semibold">D20 • D18 • D12</div>
                <div className="text-xs text-zinc-400">Remaining: {player.score}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Visits feed + camera placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm uppercase tracking-[0.2em] text-zinc-400">Visit Feed</div>
              <div className="text-xs text-zinc-500">Latest first</div>
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {visits.map((visit, idx) => {
                const player = players.find(p => p.id === visit.playerId);
                return (
                  <div
                    key={`${visit.playerId}-${idx}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 bg-black/40 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: player?.accent || '#a855f7' }}
                      />
                      <div>
                        <div className="text-sm font-semibold">{player?.name || 'Player'}</div>
                        <div className="text-xs text-zinc-400">{visit.darts}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{visit.score}</div>
                      {visit.note && <div className="text-xs text-emerald-400">{visit.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm uppercase tracking-[0.2em] text-zinc-400">Video</div>
            <div className="aspect-video rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-zinc-500 text-sm">
              Your cam (placeholder)
            </div>
            <div className="aspect-video rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-zinc-500 text-sm">
              Opponent cam (placeholder)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameScreen;
