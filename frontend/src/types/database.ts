// Firestore document types

export interface Score {
  id: string;
  username: string;
  uid: string;
  photoURL: string | null;
  score: number;
  duration_ms: number;
  created_at: string;
}

export interface Duel {
  id: string;
  duration_ms: number;
  status: 'waiting' | 'active' | 'complete' | 'expired';
  start_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface DuelPlayer {
  id: string;
  duel_id: string;
  player_key: string;
  username: string;
  uid: string;
  photoURL: string | null;
  ready: boolean;
  score: number | null;
  submitted_at: string | null;
}

export interface Challenge {
  id: string;
  duration_ms: number;
  status: 'pending' | 'complete' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface ChallengeEntry {
  id: string;
  challenge_id: string;
  player_key: string;
  username: string;
  uid: string;
  photoURL: string | null;
  score: number;
  submitted_at: string;
}

export interface UserStats {
  trophies: number;
  username?: string;
  photoURL?: string | null;
}

// Tournament types

export interface Tournament {
  id: string;
  name: string;
  duration_ms: number;
  status: 'registration' | 'active' | 'complete' | 'cancelled';
  max_players: 4 | 8 | 16;
  current_round: number;
  total_rounds: number;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  winner_uid: string | null;
  winner_username: string | null;
  trophy_prize: number;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  uid: string;
  username: string;
  photoURL: string | null;
  seed: number;
  status: 'active' | 'eliminated';
  eliminated_round: number | null;
  registered_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_uid: string | null;
  player1_username: string | null;
  player1_photoURL: string | null;
  player2_uid: string | null;
  player2_username: string | null;
  player2_photoURL: string | null;
  winner_uid: string | null;
  duel_id: string | null;
  status: 'pending' | 'ready' | 'active' | 'complete';
  player1_score: number | null;
  player2_score: number | null;
  next_match_id: string | null;
}
