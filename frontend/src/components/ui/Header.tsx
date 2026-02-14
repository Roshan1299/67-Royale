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
    <header className="fixed top-0 left-0 right-0 z-50 px-3 py-2 sm:px-4 sm:py-2.5 bg-black/30 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1">
          <Link href="/" className="flex items-center gap-1.5 group">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md overflow-hidden group-hover:scale-105 transition-transform">
              <Image
                src={iconImage}
                alt="67 Royale"
                width={28}
                height={28}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm sm:text-base font-bold text-white tracking-tight">ROYALE</span>
          </Link>
        </div>

        {/* Mode Toggle - Centered */}
        {showNav && (
          <div className="inline-flex bg-black/50 rounded-full p-0.5 border border-white/10">
            <Link
              href="/leaderboard"
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isLeaderboardPage
                  ? 'bg-accent-blue text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 21h10v-2H7v2zm5-18L2 9l2 1.5L12 5l8 5.5L22 9 12 3zm0 4.58L5.66 12 12 16.42 18.34 12 12 7.58z"/>
              </svg>
            </Link>
            <Link
              href="/"
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                !isDuelPage && !isPvpPage && !isLeaderboardPage && !isTournamentPage
                  ? 'bg-accent-blue text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              SOLO
            </Link>
            <Link
              href="/pvp"
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isPvpPage
                  ? 'bg-accent-blue text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              PVP
            </Link>
            <Link
              href="/duel"
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isDuelPage
                  ? 'bg-accent-blue text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              FRIENDLY
            </Link>
            <Link
              href="/tournament"
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all relative ${
                isTournamentPage
                  ? 'bg-accent-blue text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              TOURNAMENT
              {/* Lock icon overlay */}
              <svg className="w-3 h-3 absolute -top-0.5 -right-0.5 text-white/60" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
              </svg>
            </Link>
          </div>
        )}

        {/* Right side: player count + user avatar */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
          {playerCount !== null && playerCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] sm:text-xs text-white/40 bg-black/50 px-3 py-1.5 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue"></span>
              <span className="text-accent-blue font-medium">{playerCount.toLocaleString()}</span>
              <span>users</span>
            </div>
          )}

          {/* Trophy count */}
          {user && trophies !== null && (
            <div className="flex items-center gap-1 text-xs font-bold" style={{ color: '#FFD700' }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3h14v2H5V3zm0 2v4c0 3.87 3.13 7 7 7s7-3.13 7-7V5h3v4a4 4 0 01-3 3.87V15h1v2H9v-2h1v-2.13A4 4 0 017 9V5H5zm2 0v4c0 2.76 2.24 5 5 5s5-2.24 5-5V5H7zm2 14h6v2H9v-2z"/>
              </svg>
              <span>{trophies}</span>
            </div>
          )}

          {/* User avatar / menu */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center justify-center rounded-full border border-white/10 hover:border-white/30 transition-all focus:outline-none focus:ring-2 focus:ring-accent-blue/50 overflow-hidden"
                style={{ width: 32, height: 32 }}
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
                  <div className="w-full h-full bg-accent-blue/20 flex items-center justify-center">
                    <span className="text-accent-blue font-bold text-xs">{initials}</span>
                  </div>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-black/90 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-white text-sm font-medium truncate">{user.displayName || 'Player'}</p>
                    {user.email && (
                      <p className="text-white/40 text-xs truncate mt-0.5">{user.email}</p>
                    )}
                  </div>

                  {/* Logout */}
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
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
