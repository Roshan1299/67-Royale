import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { verifySessionToken, validateSubmissionTiming } from '@/lib/jwt';
import { checkRateLimit, createRateLimitKey } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Verify Firebase auth token for username/uid/photoURL
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token, score } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (typeof score !== 'number' || score < 0 || !Number.isInteger(score)) {
      return NextResponse.json({ error: 'Score must be a non-negative integer' }, { status: 400 });
    }

    // Verify token
    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (payload.mode !== 'challenge') {
      return NextResponse.json({ error: 'Invalid token mode' }, { status: 400 });
    }

    if (!payload.challenge_id || !payload.player_key) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 });
    }

    // Validate timing
    const timingValidation = validateSubmissionTiming(payload, Date.now());
    if (!timingValidation.valid) {
      return NextResponse.json({ error: timingValidation.reason }, { status: 400 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const rateLimitKey = createRateLimitKey(ip, payload.player_key);
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rateLimit.retryAfter} seconds` },
        { status: 429 }
      );
    }

    const db = getDb();

    // Check for duplicate entry first
    const duplicateSnap = await db
      .collection('challenge_entries')
      .where('challenge_id', '==', payload.challenge_id)
      .where('player_key', '==', payload.player_key)
      .get();

    if (!duplicateSnap.empty) {
      return NextResponse.json({ error: 'You have already submitted a score' }, { status: 400 });
    }

    // Insert entry with uid, photoURL, username from auth
    await db.collection('challenge_entries').add({
      challenge_id: payload.challenge_id,
      player_key: payload.player_key,
      uid: user.uid,
      username: user.displayName,
      photo_url: user.photoURL,
      score,
    });

    // Check if both players have submitted
    const entriesSnap = await db
      .collection('challenge_entries')
      .where('challenge_id', '==', payload.challenge_id)
      .get();

    const entries = entriesSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as Array<{ id: string; player_key: string; username: string; score: number }>;

    if (entries.length >= 2) {
      // Mark challenge as complete
      await db.collection('challenges').doc(payload.challenge_id).update({ status: 'complete' });

      // Determine winner
      const myEntry = entries.find(e => e.player_key === payload.player_key);
      const opponent = entries.find(e => e.player_key !== payload.player_key);

      let outcome: 'win' | 'lose' | 'tie' = 'tie';
      if (myEntry && opponent) {
        if (myEntry.score > opponent.score) outcome = 'win';
        else if (myEntry.score < opponent.score) outcome = 'lose';
      }

      return NextResponse.json({
        status: 'complete',
        result: {
          myScore: myEntry?.score,
          myUsername: myEntry?.username,
          opponentScore: opponent?.score,
          opponentUsername: opponent?.username,
          outcome
        }
      });
    }

    return NextResponse.json({ status: 'waiting' });
  } catch (error) {
    console.error('Challenge submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
