'use client';

import { Header } from '@/components/ui/Header';

const LockIcon = () => (
  <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="11" width="14" height="10" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
    <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z"/>
  </svg>
);

export default function TournamentPage() {
  return (
    <main className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial">
      <Header />

      <div className="min-h-screen flex items-center justify-center p-4 pt-16 pb-12">
        <div className="w-full max-w-lg">
          {/* Coming Soon Card */}
          <div className="relative glass-panel rounded-2xl p-12 border border-white/10 overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 via-transparent to-red-500/5 animate-pulse"></div>

            {/* Lock background pattern */}
            <div className="absolute top-8 right-8 opacity-5">
              <TrophyIcon />
            </div>
            <div className="absolute bottom-8 left-8 opacity-5">
              <TrophyIcon />
            </div>

            {/* Content */}
            <div className="relative text-center">
              {/* Lock Icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-accent-blue/20 blur-2xl rounded-full"></div>
                  <div className="relative text-white/40">
                    <LockIcon />
                  </div>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
                TOURNAMENTS
              </h1>

              {/* Coming Soon Badge */}
              <div className="inline-block px-4 py-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 mb-6">
                <span className="text-accent-blue text-sm font-bold uppercase tracking-wider">
                  Coming Soon
                </span>
              </div>

              {/* Description */}
              <p className="text-white/50 text-base mb-4 max-w-md mx-auto leading-relaxed">
                Compete in organized brackets with multiple players for exclusive prizes and glory.
              </p>

              {/* Feature List */}
              <div className="space-y-2 text-left max-w-sm mx-auto">
                <div className="flex items-center gap-3 text-white/40 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue/40"></div>
                  <span>Single & Double Elimination Brackets</span>
                </div>
                <div className="flex items-center gap-3 text-white/40 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue/40"></div>
                  <span>Scheduled Events & Championships</span>
                </div>
                <div className="flex items-center gap-3 text-white/40 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue/40"></div>
                  <span>Spectator Mode & Replays</span>
                </div>
                <div className="flex items-center gap-3 text-white/40 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue/40"></div>
                  <span>Exclusive Tournament Rewards</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-white/30 text-xs">
                  Stay tuned for updates on our first tournament season
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
