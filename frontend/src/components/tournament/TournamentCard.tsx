'use client';

import Link from 'next/link';
import { Tournament } from '@/types/database';
import { is67RepsMode } from '@/types/game';

interface TournamentCardProps {
  tournament: Tournament & { player_count: number };
}

function formatDuration(ms: number): string {
  if (is67RepsMode(ms)) return '67 Reps';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

const statusColors: Record<string, string> = {
  registration: 'bg-green-500/20 text-green-400 border-green-500/30',
  active: 'bg-red-500/20 text-red-400 border-red-500/30',
  complete: 'bg-white/10 text-white/50 border-white/20',
  cancelled: 'bg-white/5 text-white/30 border-white/10',
};

const statusLabels: Record<string, string> = {
  registration: 'Open',
  active: 'Live',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export function TournamentCard({ tournament }: TournamentCardProps) {
  return (
    <Link href={`/tournament/${tournament.id}`}>
      <div className="glass-panel rounded-xl p-4 border border-white/10 hover:border-red-500/30 transition-all hover:shadow-lg hover:shadow-red-500/5 cursor-pointer group">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-sm truncate group-hover:text-red-400 transition-colors">
              {tournament.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-white/40 text-xs">{formatDuration(tournament.duration_ms)}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/40 text-xs">
                {tournament.player_count}/{tournament.max_players} players
              </span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              statusColors[tournament.status] || statusColors.complete
            }`}
          >
            {statusLabels[tournament.status] || tournament.status}
          </span>
        </div>
        {tournament.status === 'complete' && tournament.winner_username && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z" />
            </svg>
            <span className="text-yellow-400 text-xs font-medium">{tournament.winner_username}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
