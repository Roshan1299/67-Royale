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
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 flex justify-center">
        <div className="w-full max-w-4xl">
          {/* Glass card */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {/* Top tab toggle: Solo | PvP */}
            <div className="p-5 sm:p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="flex bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setTab('solo')}
                  className={`flex-1 py-3 rounded-lg text-base font-bold transition-all ${
                    tab === 'solo' ? 'bg-accent-blue text-black shadow-lg shadow-accent-blue/20' : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Solo
                </button>
                <button
                  onClick={() => setTab('pvp')}
                  className={`flex-1 py-3 rounded-lg text-base font-bold transition-all ${
                    tab === 'pvp' ? 'bg-accent-blue text-black shadow-lg shadow-accent-blue/20' : 'text-white/50 hover:text-white hover:bg-white/5'
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
      <div className="p-5 sm:p-6 space-y-3 border-b border-white/5">
        {/* Timeframe toggle */}
        <div className="flex bg-white/5 rounded-lg p-1">
          {(['daily', 'all'] as LeaderboardTimeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                timeframe === tf ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {tf === 'daily' ? 'Daily' : 'All-Time'}
            </button>
          ))}
        </div>

        {/* Duration tabs */}
        <div className="flex bg-white/5 rounded-lg p-1 gap-1">
          {durations.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedDuration(id)}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                selectedDuration === id ? 'bg-accent-blue text-black shadow-lg shadow-accent-blue/20' : 'text-white/50 hover:text-white hover:bg-white/5'
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
          <div className="p-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={refresh} className="text-accent-blue text-sm hover:underline font-medium">Try again</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/40 text-base">No scores yet</p>
          </div>
        ) : (
          entries.slice(0, 50).map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center px-5 sm:px-6 py-4 border-b border-white/5 last:border-b-0 transition-all ${
                entry.rank <= 3 ? 'bg-gradient-to-r from-white/[0.03] to-transparent' : 'hover:bg-white/[0.02]'
              }`}
              style={{ animation: `fadeIn 0.2s ease-out ${i * 0.015}s both` }}
            >
              {/* Rank */}
              <div className="w-16 flex-shrink-0">
                <span className={`text-lg font-black ${getRankColor(entry.rank)}`}>
                  #{entry.rank}
                </span>
              </div>

              {/* Avatar */}
              <div className={`${entry.rank <= 3 ? 'w-12 h-12' : 'w-10 h-10'} rounded-full overflow-hidden flex-shrink-0 mr-4 bg-gradient-to-br from-accent-blue/20 to-purple-500/20 ring-2 ${entry.rank === 1 ? 'ring-yellow-400/40' : entry.rank === 2 ? 'ring-gray-300/40' : entry.rank === 3 ? 'ring-amber-600/40' : 'ring-white/10'}`}>
                {entry.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50">
                    {(entry.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0 mr-4">
                <p className={`truncate ${entry.rank <= 3 ? 'text-base text-white font-semibold' : 'text-base text-white/70'}`}>
                  {entry.username}
                </p>
              </div>

              {/* Score */}
              <div className="flex-shrink-0 text-right">
                <span className={`${entry.rank <= 3 ? 'text-xl' : 'text-lg'} font-black tabular-nums ${entry.rank <= 3 ? 'text-accent-blue' : 'text-white/80'}`}>
                  {is67Reps ? (entry.score / 1000).toFixed(2) : entry.score}
                </span>
                {is67Reps && <span className="text-white/40 text-sm ml-1">s</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-3 border-t border-white/5 bg-gradient-to-t from-white/[0.02] to-transparent">
        <span className="text-xs text-white/40 font-mono">Top 50 &bull; Auto-refresh 60s</span>
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
          <div className="p-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={refresh} className="text-accent-blue text-sm hover:underline font-medium">Try again</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/40 text-base">No PvP scores yet</p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.uid}
              className={`flex items-center px-5 sm:px-6 py-4 border-b border-white/5 last:border-b-0 transition-all ${
                entry.rank <= 3 ? 'bg-gradient-to-r from-white/[0.03] to-transparent' : 'hover:bg-white/[0.02]'
              }`}
              style={{ animation: `fadeIn 0.2s ease-out ${i * 0.015}s both` }}
            >
              {/* Rank */}
              <div className="w-16 flex-shrink-0">
                <span className={`text-lg font-black ${getRankColor(entry.rank)}`}>
                  #{entry.rank}
                </span>
              </div>

              {/* Avatar */}
              <div className={`${entry.rank <= 3 ? 'w-12 h-12' : 'w-10 h-10'} rounded-full overflow-hidden flex-shrink-0 mr-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 ring-2 ${entry.rank === 1 ? 'ring-yellow-400/40' : entry.rank === 2 ? 'ring-gray-300/40' : entry.rank === 3 ? 'ring-amber-600/40' : 'ring-white/10'}`}>
                {entry.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50">
                    {(entry.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0 mr-4">
                <p className={`truncate ${entry.rank <= 3 ? 'text-base text-white font-semibold' : 'text-base text-white/70'}`}>
                  {entry.username}
                </p>
              </div>

              {/* Trophies */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <svg className={`${entry.rank <= 3 ? 'w-6 h-6' : 'w-5 h-5'}`} viewBox="0 0 24 24" fill="#FFD700">
                  <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z"/>
                </svg>
                <span className={`${entry.rank <= 3 ? 'text-xl' : 'text-lg'} font-black tabular-nums`} style={{ color: '#FFD700' }}>
                  {entry.trophies}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-3 border-t border-white/5 bg-gradient-to-t from-white/[0.02] to-transparent">
        <span className="text-xs text-white/40 font-mono">Top 50 &bull; Auto-refresh 60s</span>
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
        <div key={i} className="flex items-center px-5 sm:px-6 py-4 border-b border-white/5">
          <div className="w-16 flex-shrink-0">
            <div className="w-8 h-5 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse flex-shrink-0 mr-4" />
          <div className="flex-1 min-w-0 mr-4">
            <div className="h-5 bg-white/5 rounded w-32 animate-pulse" />
          </div>
          <div className="flex-shrink-0">
            <div className="h-5 bg-white/5 rounded w-12 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
