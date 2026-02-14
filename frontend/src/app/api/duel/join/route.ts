import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Verify Firebase auth token
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { duelId } = body;

    // Validate inputs
    if (!duelId || typeof duelId !== 'string') {
      return NextResponse.json({ error: 'duelId is required' }, { status: 400 });
    }

    const db = getDb();

    // Check duel exists and is waiting
    const duelDoc = await db.collection('duels').doc(duelId).get();
    if (!duelDoc.exists) {
      return NextResponse.json({ error: 'Duel not found' }, { status: 404 });
    }

    const duel = { id: duelDoc.id, ...duelDoc.data() } as { id: string; status: string; expires_at: string };

    if (duel.status === 'expired' || new Date(duel.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Duel has expired' }, { status: 400 });
    }

    if (duel.status !== 'waiting') {
      return NextResponse.json({ error: 'Duel is not accepting new players' }, { status: 400 });
    }

    // Check player count
    const playersSnap = await db.collection('duel_players').where('duel_id', '==', duelId).get();
    if (playersSnap.docs.length >= 2) {
      return NextResponse.json({ error: 'Duel is full' }, { status: 400 });
    }

    // Add player B
    const playerKey = randomUUID();
    try {
      await db.collection('duel_players').add({
        duel_id: duelId,
        player_key: playerKey,
        username: user.displayName,
        uid: user.uid,
        photoURL: user.photoURL,
        ready: false
      });
    } catch (err) {
      console.error('Join error:', err);
      return NextResponse.json({ error: 'Failed to join duel' }, { status: 500 });
    }

    return NextResponse.json({ player_key: playerKey });
  } catch (error) {
    console.error('Duel join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
