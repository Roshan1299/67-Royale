import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET() {
  try {
    const db = getDb();

    const snap = await db.collection('user_stats')
      .orderBy('trophies', 'desc')
      .limit(50)
      .get();

    const raw = snap.docs.map(doc => ({
      uid: doc.id,
      ...(doc.data() as { trophies: number; username?: string; photoURL?: string | null }),
    }));

    // Calculate ranks with tie handling
    const entries: { uid: string; username: string; photoURL: string | null; trophies: number; rank: number }[] = [];
    let currentRank = 1;
    let lastTrophies: number | null = null;
    let sameCount = 0;

    for (const item of raw) {
      if (lastTrophies !== null && item.trophies < lastTrophies) {
        currentRank += sameCount;
        sameCount = 1;
      } else if (lastTrophies !== null && item.trophies === lastTrophies) {
        sameCount++;
      } else {
        sameCount = 1;
      }

      entries.push({
        uid: item.uid,
        username: item.username || 'Unknown',
        photoURL: item.photoURL || null,
        trophies: item.trophies,
        rank: currentRank,
      });

      lastTrophies = item.trophies;
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('PvP leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
