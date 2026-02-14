'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const REFRESH_INTERVAL = 60000;

export interface PvpLeaderboardEntry {
  uid: string;
  username: string;
  photoURL: string | null;
  trophies: number;
  rank: number;
}

export interface UsePvpLeaderboardReturn {
  entries: PvpLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePvpLeaderboard(): UsePvpLeaderboardReturn {
  const [entries, setEntries] = useState<PvpLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/leaderboard/pvp');
      if (!res.ok) throw new Error('Failed to fetch PvP leaderboard');

      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    intervalRef.current = setInterval(fetchLeaderboard, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLeaderboard]);

  return { entries, isLoading, error, refresh: fetchLeaderboard };
}
