'use client';

import { TournamentMatch } from '@/types/database';

interface MatchCardProps {
  match: TournamentMatch;
  isMyMatch?: boolean;
  onStartMatch?: () => void;
}

function PlayerRow({
  name,
  photoURL,
  score,
  isWinner,
  isBye,
}: {
  name: string | null;
  photoURL: string | null;
  score: number | null;
  isWinner: boolean;
  isBye: boolean;
}) {
  if (!name) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 min-h-[32px]">
        <span className="text-white/20 text-xs italic">{isBye ? 'BYE' : 'TBD'}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 min-h-[32px] transition-colors ${
        isWinner ? 'bg-red-500/10' : ''
      }`}
    >
      <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
        {photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <span className={`text-xs truncate flex-1 ${isWinner ? 'text-white font-bold' : 'text-white/70'}`}>
        {name}
      </span>
      {score !== null && (
        <span className={`text-xs font-mono ${isWinner ? 'text-red-400 font-bold' : 'text-white/40'}`}>
          {score}
        </span>
      )}
      {isWinner && (
        <svg className="w-3 h-3 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      )}
    </div>
  );
}

export function MatchCard({ match, isMyMatch, onStartMatch }: MatchCardProps) {
  const isComplete = match.status === 'complete';
  const isReady = match.status === 'ready';
  const isActive = match.status === 'active';

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-all w-[180px] ${
        isActive
          ? 'border-red-500/50 shadow-lg shadow-red-500/20 animate-pulse'
          : isReady && isMyMatch
          ? 'border-red-500/30 shadow-md shadow-red-500/10'
          : isComplete
          ? 'border-white/10 opacity-80'
          : 'border-white/10'
      } bg-black/60 backdrop-blur-sm`}
    >
      <PlayerRow
        name={match.player1_username}
        photoURL={match.player1_photoURL}
        score={match.player1_score}
        isWinner={isComplete && match.winner_uid === match.player1_uid}
        isBye={isComplete && !match.player1_uid && !!match.player2_uid}
      />
      <div className="border-t border-white/5" />
      <PlayerRow
        name={match.player2_username}
        photoURL={match.player2_photoURL}
        score={match.player2_score}
        isWinner={isComplete && match.winner_uid === match.player2_uid}
        isBye={isComplete && !match.player2_uid && !!match.player1_uid}
      />
      {(isReady || isActive) && isMyMatch && onStartMatch && (
        <button
          onClick={onStartMatch}
          className="w-full py-1.5 text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-all uppercase tracking-wider"
        >
          Play Match
        </button>
      )}
      {isActive && !isMyMatch && (
        <div className="w-full py-1 text-[10px] font-bold text-red-400 text-center bg-red-500/10 uppercase tracking-wider">
          In Progress
        </div>
      )}
    </div>
  );
}
