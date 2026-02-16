import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET() {
  try {
    const db = getDb();

    // Get all non-cancelled tournaments ordered by creation date
    const snap = await db.collection('tournaments')
      .where('status', '!=', 'cancelled')
      .orderBy('status')
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const tournaments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get participant counts for each tournament
    const tournamentIds = tournaments.map(t => t.id);
    const counts: Record<string, number> = {};

    // Batch queries in groups of 30 (Firestore 'in' limit)
    for (let i = 0; i < tournamentIds.length; i += 30) {
      const batch = tournamentIds.slice(i, i + 30);
      const participantsSnap = await db.collection('tournament_participants')
        .where('tournament_id', 'in', batch)
        .get();

      for (const doc of participantsSnap.docs) {
        const tid = doc.data().tournament_id;
        counts[tid] = (counts[tid] || 0) + 1;
      }
    }

    const result = tournaments.map(t => ({
      ...t,
      player_count: counts[t.id] || 0,
    }));

    return NextResponse.json({ tournaments: result });
  } catch (error) {
    console.error('Tournament list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
