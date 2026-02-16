'use client';

import { TournamentMatch } from '@/types/database';
import { MatchCard } from './MatchCard';

interface BracketProps {
  matches: TournamentMatch[];
  totalRounds: number;
  currentUserUid: string | null;
  onStartMatch?: (matchId: string) => void;
}

const ROUND_LABELS: Record<number, Record<number, string>> = {
  2: { 1: 'Semifinals', 2: 'Final' },
  3: { 1: 'Quarterfinals', 2: 'Semifinals', 3: 'Final' },
  4: { 1: 'Round of 16', 2: 'Quarterfinals', 3: 'Semifinals', 4: 'Final' },
};

export function Bracket({ matches, totalRounds, currentUserUid, onStartMatch }: BracketProps) {
  // Group matches by round
  const matchesByRound: Record<number, TournamentMatch[]> = {};
  for (let r = 1; r <= totalRounds; r++) {
    matchesByRound[r] = matches
      .filter(m => m.round === r)
      .sort((a, b) => a.match_number - b.match_number);
  }

  const labels = ROUND_LABELS[totalRounds] || {};

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-0 min-w-fit items-start justify-center mx-auto">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => {
          const roundMatches = matchesByRound[round] || [];
          // Calculate vertical spacing: each successive round has more vertical space
          // Round 1: base gap, Round 2: 2x, etc.
          const matchGap = round === 1 ? 8 : 8 * Math.pow(2, round - 1);
          const topPadding = round === 1 ? 0 : (Math.pow(2, round - 1) - 1) * 40;

          return (
            <div key={round} className="flex flex-col items-center flex-shrink-0">
              {/* Round label */}
              <div className="mb-4 text-center">
                <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
                  {labels[round] || `Round ${round}`}
                </span>
              </div>

              {/* Matches column with connectors */}
              <div className="relative flex flex-col" style={{ gap: `${matchGap}px`, paddingTop: `${topPadding}px` }}>
                {roundMatches.map(match => {
                  const isMyMatch =
                    currentUserUid !== null &&
                    (match.player1_uid === currentUserUid || match.player2_uid === currentUserUid);

                  return (
                    <div key={match.id} className="relative flex items-center">
                      {/* Connector line from previous round */}
                      {round > 1 && (
                        <div className="absolute -left-8 top-1/2 w-8 h-px bg-white/10" />
                      )}

                      <MatchCard
                        match={match}
                        isMyMatch={isMyMatch}
                        onStartMatch={onStartMatch ? () => onStartMatch(match.id) : undefined}
                      />

                      {/* Connector line to next round */}
                      {round < totalRounds && (
                        <div className="absolute -right-8 top-1/2 w-8 h-px bg-white/10" />
                      )}
                    </div>
                  );
                })}

                {/* Vertical connector lines between pairs feeding into next round */}
                {round < totalRounds &&
                  roundMatches
                    .filter((_, idx) => idx % 2 === 0)
                    .map((_, pairIdx) => {
                      // Each pair of matches connects vertically
                      const matchHeight = 66; // approximate match card height
                      const totalMatchWithGap = matchHeight + matchGap;
                      const top = topPadding + pairIdx * 2 * totalMatchWithGap + matchHeight / 2;
                      const height = totalMatchWithGap;

                      return (
                        <div
                          key={`vline-${pairIdx}`}
                          className="absolute bg-white/10"
                          style={{
                            right: '-32px',
                            top: `${top}px`,
                            width: '1px',
                            height: `${height}px`,
                          }}
                        />
                      );
                    })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
