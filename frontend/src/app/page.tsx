'use client';

import { useCallback, useEffect } from 'react';
import { GamePanel } from '@/components/game';
import { Header } from '@/components/ui/Header';

export default function Home() {
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) await response.json();
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleScoreSubmitted = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <main className="min-h-screen min-h-dvh w-full bg-bg-primary bg-grid-pattern bg-gradient-radial overflow-x-hidden">
      <Header />

      {/* Main content - centered game panel */}
      <div className="h-screen h-dvh flex items-center justify-center pt-14 sm:pt-12 pb-10 px-4 sm:px-2 lg:px-3">
        <GamePanel onScoreSubmitted={handleScoreSubmitted} />
      </div>
    </main>
  );
}
