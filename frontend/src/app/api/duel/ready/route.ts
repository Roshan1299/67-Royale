import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { duelId, player_key, ready } = body;

    // Validate inputs
    if (!duelId || typeof duelId !== 'string') {
      return NextResponse.json({ error: 'duelId is required' }, { status: 400 });
    }

    if (!player_key || typeof player_key !== 'string') {
      return NextResponse.json({ error: 'player_key is required' }, { status: 400 });
    }

    if (typeof ready !== 'boolean') {
      return NextResponse.json({ error: 'ready must be a boolean' }, { status: 400 });
    }

    const db = getDb();

    // Update player ready status
    try {
      const snap = await db.collection('duel_players')
        .where('duel_id', '==', duelId)
        .where('player_key', '==', player_key)
        .get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({ ready });
      }
    } catch (err) {
      console.error('Ready update error:', err);
      return NextResponse.json({ error: 'Failed to update ready status' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Duel ready error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
