import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { MIN_CUSTOM_DURATION, MAX_CUSTOM_DURATION } from '@/types/game';
import { randomUUID } from 'crypto';

const CHALLENGE_EXPIRY_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    // Verify Firebase auth token for username/uid
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { duration_ms } = body;

    // Validate duration
    if (typeof duration_ms !== 'number') {
      return NextResponse.json({ error: 'duration_ms is required' }, { status: 400 });
    }

    if (duration_ms < MIN_CUSTOM_DURATION || duration_ms > MAX_CUSTOM_DURATION) {
      return NextResponse.json(
        { error: `duration_ms must be between ${MIN_CUSTOM_DURATION}ms and ${MAX_CUSTOM_DURATION}ms` },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Create challenge
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const playerKey = randomUUID();

    const docRef = await db.collection('challenges').add({
      duration_ms,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shareUrl = `${appUrl}/challenge/${docRef.id}`;

    return NextResponse.json({
      challengeId: docRef.id,
      player_key: playerKey,
      shareUrl
    });
  } catch (error) {
    console.error('Challenge create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
