'use client';

import { useState } from 'react';
import { Header } from '@/components/ui/Header';
import { TournamentCard } from '@/components/tournament/TournamentCard';
import { useTournamentList } from '@/hooks/useTournament';
import { useAuth } from '@/contexts/AuthContext';
import { DURATION_6_7S, DURATION_20S, DURATION_67_REPS } from '@/types/game';

const DURATION_OPTIONS = [
  { label: '6.7s', value: DURATION_6_7S },
  { label: '20s', value: DURATION_20S },
  { label: '67 Reps', value: DURATION_67_REPS },
];

const SIZE_OPTIONS = [
  { label: '4 Players', value: 4 as const },
  { label: '8 Players', value: 8 as const },
  { label: '16 Players', value: 16 as const },
];

export default function TournamentPage() {
  const { user, signInWithGoogle, getIdToken } = useAuth();
  const { tournaments, loading } = useTournamentList();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(DURATION_20S);
  const [maxPlayers, setMaxPlayers] = useState<4 | 8 | 16>(4);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [error, setError] = useState<string | null>(null);

  const filteredTournaments = filter === 'mine' && user
    ? tournaments.filter(t => t.created_by === user.uid)
    : tournaments;

  const handleCreate = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    if (!name.trim()) {
      setError('Enter a tournament name');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/tournament/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), duration_ms: duration, max_players: maxPlayers }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create');
        return;
      }

      const data = await res.json();
      window.location.href = `/tournament/${data.tournamentId}`;
    } catch {
      setError('Failed to create tournament');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial">
      <Header />

      <div className="min-h-screen p-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">TOURNAMENTS</h1>
            <p className="text-white/40 text-sm">Compete in single-elimination brackets for glory and trophies</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filter === 'all' ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white/60'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('mine')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filter === 'mine' ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white/60'
                }`}
              >
                My Tournaments
              </button>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  signInWithGoogle();
                  return;
                }
                setShowCreate(!showCreate);
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold hover:from-red-600 hover:to-orange-600 transition-all"
            >
              {showCreate ? 'Cancel' : 'Create Tournament'}
            </button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div className="glass-panel rounded-xl p-5 border border-white/10 mb-6">
              <div className="space-y-4">
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Tournament Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Friday Night Throwdown"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Game Mode</label>
                  <div className="flex gap-2">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDuration(opt.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                          duration === opt.value
                            ? 'bg-red-500/20 border-red-500/40 text-red-400'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Bracket Size</label>
                  <div className="flex gap-2">
                    {SIZE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setMaxPlayers(opt.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                          maxPlayers === opt.value
                            ? 'bg-red-500/20 border-red-500/40 text-red-400'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Join'}
                </button>
              </div>
            </div>
          )}

          {/* Tournament List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredTournaments.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-12 h-12 text-white/10 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z" />
              </svg>
              <p className="text-white/30 text-sm">
                {filter === 'mine' ? 'You haven\'t created any tournaments yet' : 'No tournaments yet. Create the first one!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTournaments.map(t => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
