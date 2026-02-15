'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import iconImage from '@/app/icon.png';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = true }: HeaderProps) {
  const pathname = usePathname();
  const isDuelPage = pathname?.startsWith('/duel');
  const isPvpPage = pathname?.startsWith('/pvp');
  const isLeaderboardPage = pathname?.startsWith('/leaderboard');
  const isTournamentPage = pathname?.startsWith('/tournament');
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [trophies, setTrophies] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setPlayerCount(data.totalGames || 0);
        }
      } catch {
        // Silently fail
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrophies(null);
      return;
    }
    const fetchTrophies = async () => {
      try {
        const res = await fetch(`/api/user/stats?uid=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setTrophies(data.trophies ?? 0);
        }
      } catch {
        // Silently fail
      }
    };
    fetchTrophies();
  }, [user?.uid]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const initials = (user?.displayName || 'A')
    .split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-b from-black/80 via-black/60 to-transparent backdrop-blur-xl">
      <div className="max-w-7xl mx-auto grid grid-cols-3 items-center gap-4">
        {/* Logo - Left */}
        <Link href="/" className="flex items-center gap-2 group justify-self-start">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden group-hover:scale-110 transition-transform duration-200">
            <Image
              src={iconImage}
              alt="67 Royale"
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-black text-white tracking-wide leading-none">67 ROYALE</span>
            <span className="text-[9px] sm:text-[10px] text-accent-blue/80 font-medium tracking-wider">BRAINROT EDITION</span>
          </div>
        </Link>

        {/* Mode Navigation - Center (Fixed) */}
        {showNav && (
          <nav className="hidden md:flex items-center gap-1 justify-self-center">
            <Link
              href="/leaderboard"
              className={`group relative px-3 py-2 text-sm font-bold transition-all duration-200 ${
                isLeaderboardPage
                  ? 'text-accent-blue'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="relative z-10">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 21h10v-2H7v2zm5-18L2 9l2 1.5L12 5l8 5.5L22 9 12 3zm0 4.58L5.66 12 12 16.42 18.34 12 12 7.58z"/>
                </svg>
              </span>
              {isLeaderboardPage && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
              )}
            </Link>

            <Link
              href="/"
              className={`group relative px-4 py-2 text-sm font-bold transition-all duration-200 ${
                !isDuelPage && !isPvpPage && !isLeaderboardPage && !isTournamentPage
                  ? 'text-accent-blue'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="relative z-10">SOLO</span>
              {!isDuelPage && !isPvpPage && !isLeaderboardPage && !isTournamentPage && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
              )}
            </Link>

            <Link
              href="/pvp"
              className={`group relative px-4 py-2 text-sm font-bold transition-all duration-200 ${
                isPvpPage
                  ? 'text-accent-blue'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="relative z-10">PVP</span>
              {isPvpPage && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
              )}
            </Link>

            <Link
              href="/duel"
              className={`group relative px-4 py-2 text-sm font-bold transition-all duration-200 ${
                isDuelPage
                  ? 'text-accent-blue'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="relative z-10">FRIENDLY</span>
              {isDuelPage && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
              )}
            </Link>

            <Link
              href="/tournament"
              className={`group relative px-4 py-2 text-sm font-bold transition-all duration-200 ${
                isTournamentPage
                  ? 'text-accent-blue'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="relative z-10 flex items-center gap-1.5">
                TOURNAMENT
                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                </svg>
              </span>
              {isTournamentPage && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
              )}
            </Link>
          </nav>
        )}

        {/* Right side: stats + user - Right (Fixed width to prevent shifting) */}
        <div className="flex items-center gap-3 justify-self-end min-w-[200px] justify-end">
          {/* Player count */}
          {playerCount !== null && playerCount > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-accent-blue text-xs font-bold">{playerCount.toLocaleString()}</span>
              <span className="text-white/40 text-xs">online</span>
            </div>
          )}

          {/* Trophy count */}
          {user && trophies !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FFD700">
                <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z"/>
              </svg>
              <span className="text-yellow-400 text-xs font-bold">{trophies}</span>
            </div>
          )}

          {/* User avatar */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-accent-blue/30 hover:border-accent-blue transition-all focus:outline-none focus:ring-2 focus:ring-accent-blue/50 overflow-hidden shadow-lg shadow-accent-blue/10"
                aria-label="User menu"
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent-blue to-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{initials}</span>
                  </div>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-black/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-4 bg-gradient-to-br from-accent-blue/10 to-transparent border-b border-white/10">
                    <p className="text-white text-sm font-bold truncate">{user.displayName || 'Player'}</p>
                    {user.email && (
                      <p className="text-white/50 text-xs truncate mt-1">{user.email}</p>
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 font-medium"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
