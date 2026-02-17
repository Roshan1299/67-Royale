import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { MIN_CUSTOM_DURATION, MAX_CUSTOM_DURATION, is67RepsMode } from '@/types/game';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { name, duration_ms, max_players } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      return NextResponse.json({ error: 'Name must be 1-50 characters' }, { status: 400 });
    }

    if (typeof duration_ms !== 'number') {
      return NextResponse.json({ error: 'duration_ms is required' }, { status: 400 });
    }

    const is67Reps = is67RepsMode(duration_ms);
    if (!is67Reps && (duration_ms < MIN_CUSTOM_DURATION || duration_ms > MAX_CUSTOM_DURATION)) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    if (max_players !== 4 && max_players !== 8 && max_players !== 16) {
      return NextResponse.json({ error: 'max_players must be 4, 8, or 16' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    const total_rounds = max_players === 4 ? 2 : max_players === 8 ? 3 : 4;

    const tournamentRef = await db.collection('tournaments').add({
      name: name.trim(),
      duration_ms,
      status: 'registration',
      max_players,
      current_round: 0,
      total_rounds,
      created_by: user.uid,
      created_at: now,
      started_at: null,
      completed_at: null,
      winner_uid: null,
      winner_username: null,
      trophy_prize: 100,
    });

    // Auto-register the creator
    await db.collection('tournament_participants').add({
      tournament_id: tournamentRef.id,
      uid: user.uid,
      username: user.displayName,
      photoURL: user.photoURL,
      seed: 0,
      status: 'active',
      eliminated_round: null,
      registered_at: now,
    });

    return NextResponse.json({ tournamentId: tournamentRef.id });
  } catch (error) {
    console.error('Tournament create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
