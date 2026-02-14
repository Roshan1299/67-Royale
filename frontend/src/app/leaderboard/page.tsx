'use client';

import { useState } from 'react';
import { Header } from '@/components/ui/Header';
import { useLeaderboard, LeaderboardTimeframe } from '@/hooks/useLeaderboard';
import { usePvpLeaderboard } from '@/hooks/usePvpLeaderboard';
import { DURATION_6_7S, DURATION_20S, DURATION_67_REPS, is67RepsMode } from '@/types/game';

type Tab = 'solo' | 'pvp';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('solo');

  return (
    <div className="min-h-screen bg-black text-white">
      <Header showNav />
      <main className="pt-16 pb-8 px-4 flex justify-center">
        <div className="w-full max-w-lg">
          {/* Glass card */}
          <div className="glass-panel rounded-xl overflow-hidden border border-white/10">
            {/* Top tab toggle: Solo | PvP */}
            <div className="p-3 border-b border-white/5">
              <div className="flex bg-white/5 rounded-lg p-0.5">
                <button
                  onClick={() => setTab('solo')}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    tab === 'solo' ? 'bg-accent-blue text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  Solo
                </button>
                <button
                  onClick={() => setTab('pvp')}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    tab === 'pvp' ? 'bg-accent-blue text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  PvP
                </button>
              </div>
            </div>

            {tab === 'solo' ? <SoloTab /> : <PvpTab />}
          </div>
        </div>
      </main>
    </div>
  );
}

function SoloTab() {
  const { entries, isLoading, error, selectedDuration, setSelectedDuration, timeframe, setTimeframe, refresh } = useLeaderboard();
  const is67Reps = is67RepsMode(selectedDuration);

  const durations = [
    { id: DURATION_6_7S, label: '6.7s' },
    { id: DURATION_20S, label: '20s' },
    { id: DURATION_67_REPS, label: '67' },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="p-3 space-y-2 border-b border-white/5">
        {/* Timeframe toggle */}
        <div className="flex bg-white/5 rounded-md p-0.5">
          {(['daily', 'all'] as LeaderboardTimeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all ${
                timeframe === tf ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {tf === 'daily' ? 'Daily' : 'All-Time'}
            </button>
          ))}
        </div>

        {/* Duration tabs */}
        <div className="flex bg-white/5 rounded-md p-0.5">
          {durations.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedDuration(id)}
              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all ${
                selectedDuration === id ? 'bg-accent-blue text-black' : 'text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <Skeleton count={10} />
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-400 text-xs mb-2">{error}</p>
            <button onClick={refresh} className="text-accent-blue text-xs hover:underline">Try again</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-white/40 text-sm">No scores yet</p>
          </div>
        ) : (
          entries.slice(0, 50).map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center px-3 py-2 border-b border-white/5 last:border-b-0 ${
                entry.rank <= 3 ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'
              }`}
              style={{ animation: `fadeIn 0.2s ease-out ${i * 0.015}s both` }}
            >
              {/* Rank */}
              <div className="w-8 flex-shrink-0">
                <span className={`text-sm font-bold ${getRankColor(entry.rank)}`}>
                  #{entry.rank}
                </span>
              </div>

              {/* Avatar */}
              <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mr-2 bg-white/10">
                {entry.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/40">
                    {(entry.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0 mr-2">
                <p className={`truncate text-sm ${entry.rank <= 3 ? 'text-white font-medium' : 'text-white/70'}`}>
                  {entry.username}
                </p>
              </div>

              {/* Score */}
              <div className="flex-shrink-0 text-right">
                <span className={`text-sm font-bold tabular-nums ${entry.rank <= 3 ? 'text-accent-blue' : 'text-white/80'}`}>
                  {is67Reps ? (entry.score / 1000).toFixed(2) : entry.score}
                </span>
                {is67Reps && <span className="text-white/30 text-xs ml-0.5">s</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/5">
        <span className="text-[10px] text-white/30 font-mono">Top 50 &bull; Auto-refresh 60s</span>
      </div>
    </div>
  );
}

function PvpTab() {
  const { entries, isLoading, error, refresh } = usePvpLeaderboard();

  return (
    <div>
      {/* List */}
      <div className="max-h-[65vh] overflow-y-auto">
        {isLoading ? (
          <Skeleton count={10} />
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-400 text-xs mb-2">{error}</p>
            <button onClick={refresh} className="text-accent-blue text-xs hover:underline">Try again</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-white/40 text-sm">No PvP scores yet</p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.uid}
              className={`flex items-center px-3 py-2 border-b border-white/5 last:border-b-0 ${
                entry.rank <= 3 ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'
              }`}
              style={{ animation: `fadeIn 0.2s ease-out ${i * 0.015}s both` }}
            >
              {/* Rank */}
              <div className="w-8 flex-shrink-0">
                <span className={`text-sm font-bold ${getRankColor(entry.rank)}`}>
                  #{entry.rank}
                </span>
              </div>

              {/* Avatar */}
              <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mr-2 bg-white/10">
                {entry.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/40">
                    {(entry.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0 mr-2">
                <p className={`truncate text-sm ${entry.rank <= 3 ? 'text-white font-medium' : 'text-white/70'}`}>
                  {entry.username}
                </p>
              </div>

              {/* Trophies */}
              <div className="flex-shrink-0 flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FFD700">
                  <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z"/>
                </svg>
                <span className="text-sm font-bold tabular-nums" style={{ color: '#FFD700' }}>
                  {entry.trophies}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/5">
        <span className="text-[10px] text-white/30 font-mono">Top 50 &bull; Auto-refresh 60s</span>
      </div>
    </div>
  );
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-amber-600';
  return 'text-white/40';
}

function Skeleton({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center px-3 py-2 border-b border-white/5">
          <div className="w-8 flex-shrink-0">
            <div className="w-5 h-4 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="w-6 h-6 rounded-full bg-white/5 animate-pulse flex-shrink-0 mr-2" />
          <div className="flex-1 min-w-0 mr-2">
            <div className="h-4 bg-white/5 rounded w-20 animate-pulse" />
          </div>
          <div className="flex-shrink-0">
            <div className="h-4 bg-white/5 rounded w-8 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
