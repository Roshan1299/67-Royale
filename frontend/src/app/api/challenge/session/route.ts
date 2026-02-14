import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
import { createSessionToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { challengeId, player_key } = body;

    if (!challengeId || typeof challengeId !== 'string') {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
    }

    if (!player_key || typeof player_key !== 'string') {
      return NextResponse.json({ error: 'player_key is required' }, { status: 400 });
    }

    const db = getDb();

    // Get challenge details
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();

    if (!challengeDoc.exists) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const challenge = { id: challengeDoc.id, ...challengeDoc.data() } as {
      id: string;
      duration_ms: number;
      status: string;
      expires_at: string;
    };

    if (challenge.status === 'expired' || new Date(challenge.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Challenge has expired' }, { status: 400 });
    }

    // Check if this player already submitted
    const existingSnap = await db
      .collection('challenge_entries')
      .where('challenge_id', '==', challengeId)
      .where('player_key', '==', player_key)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'You have already submitted a score' }, { status: 400 });
    }

    // Create session token
    const token = await createSessionToken({
      mode: 'challenge',
      duration_ms: challenge.duration_ms,
      challenge_id: challengeId,
      player_key
    });

    return NextResponse.json({
      token,
      duration_ms: challenge.duration_ms
    });
  } catch (error) {
    console.error('Challenge session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
