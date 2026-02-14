import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { MIN_CUSTOM_DURATION, MAX_CUSTOM_DURATION, is67RepsMode } from '@/types/game';
import { randomUUID } from 'crypto';

const DUEL_EXPIRY_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    // Verify Firebase auth token
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { duration_ms } = body;

    // Validate duration
    if (typeof duration_ms !== 'number') {
      return NextResponse.json({ error: 'duration_ms is required' }, { status: 400 });
    }

    // Allow 67 reps mode (-1) or regular durations
    const is67Reps = is67RepsMode(duration_ms);
    if (!is67Reps && (duration_ms < MIN_CUSTOM_DURATION || duration_ms > MAX_CUSTOM_DURATION)) {
      return NextResponse.json(
        { error: `duration_ms must be between ${MIN_CUSTOM_DURATION}ms and ${MAX_CUSTOM_DURATION}ms, or -1 for 67 reps` },
        { status: 400 }
      );
    }

    const db = getDb();

    // Create duel
    const expiresAt = new Date(Date.now() + DUEL_EXPIRY_MINUTES * 60 * 1000);
    const playerKey = randomUUID();

    let duelId: string;
    try {
      const duelRef = await db.collection('duels').add({
        duration_ms,
        status: 'waiting',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });
      duelId = duelRef.id;
    } catch (err) {
      console.error('Duel creation error:', err);
      return NextResponse.json({ error: 'Failed to create duel' }, { status: 500 });
    }

    // Add player A
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
      console.error('Player creation error:', err);
      return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shareUrl = `${appUrl}/duel/${duelId}`;

    return NextResponse.json({
      duelId,
      player_key: playerKey,
      shareUrl
    });
  } catch (error) {
    console.error('Duel create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
