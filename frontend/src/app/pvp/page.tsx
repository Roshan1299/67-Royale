'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DURATION_6_7S, DURATION_20S, DURATION_67_REPS } from '@/types/game';
import { Header } from '@/components/ui/Header';

// Icons
const BoltIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
  </svg>
);

const TimerIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="13" r="7" />
    <path d="M12 10v3l1.5 1.5" strokeLinecap="round" />
    <path d="M10 2h4" strokeLinecap="round" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type PvpState = 'select' | 'searching';

export default function PvpPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const [pvpState, setPvpState] = useState<PvpState>('select');
  const [duration, setDuration] = useState<number>(DURATION_6_7S);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const queueIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      // Leave queue on unmount
      if (queueIdRef.current) {
        fetch('/api/matchmaking/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId: queueIdRef.current }),
        }).catch(() => {});
      }
    };
  }, []);

  const handleCancel = useCallback(async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);

    if (queueIdRef.current) {
      try {
        await fetch('/api/matchmaking/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId: queueIdRef.current }),
        });
      } catch {
        // Best effort
      }
      queueIdRef.current = null;
    }

    setPvpState('select');
    setSearchTime(0);
    setError(null);
  }, []);

  const pollStatus = useCallback(async () => {
    if (!queueIdRef.current || !mountedRef.current) return;

    try {
      const res = await fetch(`/api/matchmaking/status?queueId=${queueIdRef.current}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.status === 'matched' && data.duelId) {
        // Store player key and navigate to duel
        sessionStorage.setItem(`duel_${data.duelId}_player_key`, data.player_key);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (searchTimerRef.current) clearInterval(searchTimerRef.current);
        queueIdRef.current = null;
        router.push(`/duel/${data.duelId}`);
      }
    } catch {
      // Keep polling
    }
  }, [router]);

  const handleFindMatch = async () => {
    setError(null);
    setPvpState('searching');
    setSearchTime(0);

    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ duration_ms: duration }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join matchmaking');
      }

      const data = await res.json();

      if (data.status === 'matched') {
        // Instant match — navigate to duel
        sessionStorage.setItem(`duel_${data.duelId}_player_key`, data.player_key);
        router.push(`/duel/${data.duelId}`);
        return;
      }

      // Waiting — start polling
      queueIdRef.current = data.queueId;

      // Poll every 2s
      pollIntervalRef.current = setInterval(pollStatus, 2000);

      // Search timer
      searchTimerRef.current = setInterval(() => {
        setSearchTime(t => t + 1);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find match');
      setPvpState('select');
    }
  };

  const modes = [
    { id: DURATION_6_7S, title: '6.7s', subtitle: 'Sprint', icon: BoltIcon },
    { id: DURATION_20S, title: '20s', subtitle: 'Endurance', icon: TimerIcon },
    { id: DURATION_67_REPS, title: '67', subtitle: 'Reps', icon: TargetIcon },
  ];

  const selectedMode = modes.find(m => m.id === duration);

  const formatSearchTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial">
      <Header />

      <div className="min-h-screen flex items-center justify-center p-4 pt-16 pb-12">
        <div className="glass-panel rounded-2xl w-full max-w-md animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-white/5">
            <button
              onClick={() => pvpState === 'searching' ? handleCancel() : router.push('/')}
              className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              <ArrowLeftIcon />
              <span>{pvpState === 'searching' ? 'Cancel' : 'Back'}</span>
            </button>
          </div>

          <div className="p-5">
            {pvpState === 'select' ? (
              <>
                {/* Title */}
                <div className="text-center mb-5">
                  <h1 className="text-2xl font-bold text-white mb-1">PvP Matchmaking</h1>
                  <p className="text-white/40 text-sm">Find a random opponent and compete</p>
                </div>

                {/* User info */}
                <div className="mb-5 flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  {user?.photoURL && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      className="w-8 h-8 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div>
                    <p className="text-xs text-white/50">Playing as</p>
                    <p className="text-sm font-medium text-white">{user?.displayName || 'Anonymous'}</p>
                  </div>
                </div>

                {/* Mode Selection */}
                <div className="mb-5">
                  <label className="text-xs text-white/50 block mb-2">Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {modes.map(({ id, title, subtitle, icon: Icon }) => {
                      const isSelected = duration === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setDuration(id)}
                          className={`p-3 rounded-xl text-center transition-all ${
                            isSelected ? 'card-selected' : 'card'
                          }`}
                        >
                          <div className={`w-full flex justify-center mb-1.5 ${isSelected ? 'text-accent-blue' : 'text-white/40'}`}>
                            <Icon />
                          </div>
                          <p className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-white/70'}`}>{title}</p>
                          <p className="text-[10px] text-white/40">{subtitle}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm text-center mb-4">{error}</p>
                )}

                {/* Find Match Button */}
                <button
                  onClick={handleFindMatch}
                  className="btn-primary w-full py-3.5"
                >
                  Find Match
                </button>

                <p className="text-white/30 text-xs text-center mt-4">
                  You&apos;ll be matched with a random opponent playing the same mode
                </p>
              </>
            ) : (
              /* Searching state */
              <div className="text-center py-8">
                {/* Animated search indicator */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-accent-blue/20"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-blue animate-spin"></div>
                  <div className="absolute inset-3 rounded-full border-2 border-transparent border-b-accent-blue/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-accent-blue text-xs font-mono">{formatSearchTime(searchTime)}</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Searching for opponent...</h2>
                <p className="text-white/40 text-sm mb-1">
                  Mode: <span className="text-white/60 font-medium">{selectedMode?.title} {selectedMode?.subtitle}</span>
                </p>
                <p className="text-white/30 text-xs mb-8">
                  Waiting for another player to join
                </p>

                <button
                  onClick={handleCancel}
                  className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
