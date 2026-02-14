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
}
