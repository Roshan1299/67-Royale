import { useState, useEffect, useCallback } from 'react';
import { Tournament, TournamentParticipant, TournamentMatch } from '@/types/database';

interface TournamentData {
  tournament: Tournament | null;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTournament(tournamentId: string | null, pollInterval = 3000): TournamentData {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`/api/tournament/${tournamentId}`);
      if (!res.ok) {
        setError('Failed to load tournament');
        return;
      }
      const data = await res.json();
      setTournament(data.tournament);
      setParticipants(data.participants);
      setMatches(data.matches);
      setError(null);
    } catch {
      setError('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  return { tournament, participants, matches, loading, error, refresh: fetchData };
}

interface TournamentListItem extends Tournament {
  player_count: number;
}

interface TournamentListData {
  tournaments: TournamentListItem[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useTournamentList(pollInterval = 5000): TournamentListData {
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tournament/list');
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  return { tournaments, loading, refresh: fetchData };
}
