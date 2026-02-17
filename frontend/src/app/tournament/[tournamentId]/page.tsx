'use client';

import { use, useState } from 'react';
import { Header } from '@/components/ui/Header';
import { Bracket } from '@/components/tournament/Bracket';
import { useTournament } from '@/hooks/useTournament';
import { useAuth } from '@/contexts/AuthContext';
import { is67RepsMode } from '@/types/game';
import { useRouter } from 'next/navigation';

function formatDuration(ms: number): string {
  if (is67RepsMode(ms)) return '67 Reps';
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const { tournament, participants, matches, loading, error } = useTournament(tournamentId);
  const { user, signInWithGoogle, getIdToken } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [matchStarting, setMatchStarting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isCreator = user && tournament?.created_by === user.uid;
  const isRegistered = user && participants.some(p => p.uid === user.uid);
  const isRegistrationOpen = tournament?.status === 'registration';
  const isFull = participants.length >= (tournament?.max_players || 0);

  // Find my next match
  const myNextMatch = user
    ? matches.find(
        m =>
          (m.player1_uid === user.uid || m.player2_uid === user.uid) &&
          (m.status === 'ready' || m.status === 'active')
      )
    : null;

  const handleJoin = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setJoining(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/tournament/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Failed to join');
      }
    } catch {
      setActionError('Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/tournament/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Failed to start');
      }
    } catch {
      setActionError('Failed to start');
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this tournament? This cannot be undone.')) return;
    setCancelling(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/tournament/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Failed to cancel');
      }
    } catch {
      setActionError('Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/tournament/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Failed to leave');
      }
    } catch {
      setActionError('Failed to leave');
    } finally {
      setLeaving(false);
    }
  };

  const handleStartMatch = async (matchId: string) => {
    if (!user) return;
    setMatchStarting(matchId);
    setActionError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/tournament/match/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournament_id: tournamentId, match_id: matchId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Failed to start match');
        return;
      }
      const data = await res.json();
      // Store player_key in sessionStorage then redirect to duel (use correct key format)
      sessionStorage.setItem(`duel_${data.duelId}_player_key`, data.player_key);
      sessionStorage.setItem(`duel_tournament_return`, tournamentId);
      router.push(`/duel/${data.duelId}`);
    } catch {
      setActionError('Failed to start match');
    } finally {
      setMatchStarting(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (error || !tournament) {
    return (
      <main className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white/50">{error || 'Tournament not found'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial">
      <Header />

      <div className="min-h-screen p-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Tournament Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{tournament.name}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-white/40 text-sm">{formatDuration(tournament.duration_ms)}</span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/40 text-sm">{tournament.max_players}-player bracket</span>
                  <span className="text-white/20">·</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      tournament.status === 'registration'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : tournament.status === 'active'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : tournament.status === 'cancelled'
                        ? 'bg-white/5 text-white/30 border-white/10'
                        : 'bg-white/10 text-white/50 border-white/20'
                    }`}
                  >
                    {tournament.status === 'registration' ? 'Open' : tournament.status === 'active' ? 'Live' : tournament.status === 'cancelled' ? 'Cancelled' : 'Complete'}
                  </span>
                </div>
              </div>

              {/* Prize info */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z" />
                </svg>
                <div className="text-xs">
                  <span className="text-yellow-400 font-bold">+{tournament.trophy_prize}</span>
                  <span className="text-white/40 ml-1">1st</span>
                  <span className="text-white/20 mx-1">·</span>
                  <span className="text-yellow-400/70 font-bold">+50</span>
                  <span className="text-white/40 ml-1">2nd</span>
                  <span className="text-white/20 mx-1">·</span>
                  <span className="text-yellow-400/50 font-bold">+20</span>
                  <span className="text-white/40 ml-1">3rd-4th</span>
                </div>
              </div>
            </div>
          </div>

          {actionError && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-xs">{actionError}</p>
            </div>
          )}

          {/* Host cancel button when tournament is active */}
          {isCreator && tournament.status === 'active' && (
            <div className="mb-6">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Tournament'}
              </button>
            </div>
          )}

          {/* Cancelled Banner */}
          {tournament.status === 'cancelled' && (
            <div className="glass-panel rounded-xl p-6 border border-white/10 mb-8 text-center">
              <p className="text-white/40 text-lg font-bold">Tournament Cancelled</p>
              <p className="text-white/20 text-sm mt-1">This tournament was cancelled by the host.</p>
            </div>
          )}

          {/* Registration Phase */}
          {isRegistrationOpen && (
            <div className="glass-panel rounded-xl p-5 border border-white/10 mb-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-white font-bold text-sm mb-1">
                    Players ({participants.length}/{tournament.max_players})
                  </h2>
                  <p className="text-white/30 text-xs">Waiting for players to join...</p>
                </div>
                <div className="flex gap-2">
                  {!isRegistered && (
                    <button
                      onClick={handleJoin}
                      disabled={joining || isFull}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50"
                    >
                      {joining ? 'Joining...' : isFull ? 'Full' : 'Join Tournament'}
                    </button>
                  )}
                  {isRegistered && !isCreator && (
                    <button
                      onClick={handleLeave}
                      disabled={leaving}
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/10 hover:text-white/70 transition-all disabled:opacity-50"
                    >
                      {leaving ? 'Leaving...' : 'Leave'}
                    </button>
                  )}
                  {isCreator && participants.length >= 3 && (
                    <button
                      onClick={handleStart}
                      disabled={starting}
                      className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-all disabled:opacity-50"
                    >
                      {starting ? 'Starting...' : 'Start Tournament'}
                    </button>
                  )}
                  {isCreator && (
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Tournament'}
                    </button>
                  )}
                </div>
              </div>

              {/* Player list */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                      {p.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">{p.username.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-white/70 text-xs truncate">{p.username}</span>
                    {p.uid === tournament.created_by && (
                      <span className="text-yellow-400 text-[9px] ml-auto flex-shrink-0">HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Next Match Card */}
          {myNextMatch && (myNextMatch.status === 'ready' || myNextMatch.status === 'active') && (
            <div className="glass-panel rounded-xl p-5 border border-red-500/20 mb-8 bg-gradient-to-r from-red-500/5 to-orange-500/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-white font-bold text-sm mb-1">Your Next Match</h2>
                  <p className="text-white/40 text-xs">
                    vs{' '}
                    {myNextMatch.player1_uid === user?.uid
                      ? myNextMatch.player2_username
                      : myNextMatch.player1_username}
                  </p>
                </div>
                <button
                  onClick={() => handleStartMatch(myNextMatch.id)}
                  disabled={matchStarting === myNextMatch.id}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50 animate-pulse"
                >
                  {matchStarting === myNextMatch.id ? 'Starting...' : 'Play Now'}
                </button>
              </div>
            </div>
          )}

          {/* Winner Banner */}
          {tournament.status === 'complete' && tournament.winner_username && (
            <div className="glass-panel rounded-xl p-6 border border-yellow-500/20 mb-8 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 text-center">
              <svg className="w-10 h-10 text-yellow-400 mx-auto mb-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z" />
              </svg>
              <h2 className="text-xl font-black text-white mb-1">Tournament Champion</h2>
              <p className="text-yellow-400 font-bold text-lg">{tournament.winner_username}</p>
            </div>
          )}

          {/* Bracket */}
          {(tournament.status === 'active' || tournament.status === 'complete') && matches.length > 0 && (
            <div className="glass-panel rounded-xl p-5 border border-white/10">
              <h2 className="text-white font-bold text-sm mb-4">Bracket</h2>
              <Bracket
                matches={matches}
                totalRounds={tournament.total_rounds}
                currentUserUid={user?.uid || null}
                onStartMatch={handleStartMatch}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
