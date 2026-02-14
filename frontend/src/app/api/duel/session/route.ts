import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
import { createSessionToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { duelId, player_key } = body;

    if (!duelId || typeof duelId !== 'string') {
      return NextResponse.json({ error: 'duelId is required' }, { status: 400 });
    }

    if (!player_key || typeof player_key !== 'string') {
      return NextResponse.json({ error: 'player_key is required' }, { status: 400 });
    }

    const db = getDb();

    // Verify player belongs to duel
    const playerSnap = await db.collection('duel_players')
      .where('duel_id', '==', duelId)
      .where('player_key', '==', player_key)
      .get();

    if (playerSnap.empty) {
      return NextResponse.json({ error: 'Invalid player' }, { status: 403 });
    }

    // Get duel details
    const duelDoc = await db.collection('duels').doc(duelId).get();
    if (!duelDoc.exists) {
      return NextResponse.json({ error: 'Duel not found' }, { status: 404 });
    }

    const duel = { id: duelDoc.id, ...duelDoc.data() } as {
      id: string;
      duration_ms: number;
      status: string;
      start_at: string | null;
    };

    if (duel.status !== 'active') {
      return NextResponse.json({ error: 'Duel is not active' }, { status: 400 });
    }

    // Create session token
    const token = await createSessionToken({
      mode: 'duel',
      duration_ms: duel.duration_ms,
      duel_id: duelId,
      player_key
    });

    return NextResponse.json({
      token,
      start_at: duel.start_at ? new Date(duel.start_at).getTime() : null,
      duration_ms: duel.duration_ms
    });
  } catch (error) {
    console.error('Duel session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
