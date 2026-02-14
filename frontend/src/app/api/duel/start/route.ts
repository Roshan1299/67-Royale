import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { duelId } = body;

    if (!duelId || typeof duelId !== 'string') {
      return NextResponse.json({ error: 'duelId is required' }, { status: 400 });
    }

    const db = getDb();

    // Check duel exists
    const duelDoc = await db.collection('duels').doc(duelId).get();
    if (!duelDoc.exists) {
      return NextResponse.json({ error: 'Duel not found' }, { status: 404 });
    }

    const duel = { id: duelDoc.id, ...duelDoc.data() } as { id: string; status: string; duration_ms: number };

    if (duel.status !== 'waiting') {
      return NextResponse.json({ error: 'Duel cannot be started' }, { status: 400 });
    }

    // Check both players are ready
    const playersSnap = await db.collection('duel_players')
      .where('duel_id', '==', duelId)
      .get();

    const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{ id: string; ready: boolean }>;

    if (players.length !== 2) {
      return NextResponse.json({ error: 'Need exactly 2 players to start' }, { status: 400 });
    }

    if (!players.every(p => p.ready)) {
      return NextResponse.json({ error: 'All players must be ready' }, { status: 400 });
    }

    // Set start time (5 seconds from now to allow sync)
    const startAt = new Date(Date.now() + 5000);

    // Update duel status
    try {
      await db.collection('duels').doc(duelId).update({
        status: 'active',
        start_at: startAt.toISOString()
      });
    } catch (err) {
      console.error('Start update error:', err);
      return NextResponse.json({ error: 'Failed to start duel' }, { status: 500 });
    }

    return NextResponse.json({ start_at: startAt.getTime() });
  } catch (error) {
    console.error('Duel start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
