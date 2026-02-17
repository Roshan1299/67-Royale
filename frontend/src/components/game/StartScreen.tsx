'use client';

import Image from 'next/image';
import iconImage from '@/app/icon.png';

interface StartScreenProps {
  onStart: () => void;
  error?: string | null;
  onRetry?: () => void;
}

const PlayIcon = () => (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const CameraIcon = () => (
  <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

export function StartScreen({ onStart, error, onRetry }: StartScreenProps) {
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2">
        <div className="glass-panel p-5 sm:p-8 rounded-xl sm:rounded-2xl max-w-xs sm:max-w-sm w-full text-center animate-scale-in">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <CameraIcon />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Camera Required</h3>
          <p className="text-white/50 text-xs sm:text-sm mb-4 sm:mb-6">{error}</p>
          {onRetry && (
            <button onClick={onRetry} className="btn-primary w-full text-sm sm:text-base">
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/80 via-black/70 to-black/90 backdrop-blur-md p-4">
      <div className="text-center max-w-md animate-fade-in">
        {/* Logo Icon */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-orange-500/30 rounded-2xl blur-xl"></div>
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src={iconImage}
                alt="67 Royale"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-3 sm:mb-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-widest">
            ROYALE
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-white/50 mb-8 sm:mb-10 text-sm sm:text-base font-medium">
          Prove your speed. Dominate the leaderboard.
        </p>

        {/* Start Button */}
        <div className="relative inline-block group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition duration-300 animate-pulse"></div>
          <button
            onClick={onStart}
            className="relative flex items-center gap-3 px-10 sm:px-14 py-4 sm:py-5 bg-black rounded-xl text-white font-black text-lg sm:text-xl tracking-wide hover:scale-105 transition-transform duration-200"
          >
            <PlayIcon />
            <span>START</span>
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 sm:mt-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-white/60 text-xs sm:text-sm font-medium">
              Alternate hands up & down to count reps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
