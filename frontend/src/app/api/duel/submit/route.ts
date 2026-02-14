import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
import { verifySessionToken, validateSubmissionTiming } from '@/lib/jwt';
import { checkRateLimit, createRateLimitKey } from '@/lib/rate-limit';
import { is67RepsMode, DURATION_6_7S, DURATION_20S, DURATION_67_REPS } from '@/types/game';

// Helper to calculate rank stats for a score
async function calculateRankStats(
  duration_ms: number,
  score: number,
  is67Reps: boolean
) {
  const db = getDb();

  // Get total count for all-time
  const totalSnap = await db.collection('scores')
    .where('duration_ms', '==', duration_ms)
    .count().get();
  const totalCount = totalSnap.data().count;

  // Get all-time rank (count of better scores + 1)
  let allTimeRank = 1;
  if (is67Reps) {
    const betterSnap = await db.collection('scores')
      .where('duration_ms', '==', duration_ms)
      .where('score', '<', score)
      .count().get();
    allTimeRank = betterSnap.data().count + 1;
  } else {
    const betterSnap = await db.collection('scores')
      .where('duration_ms', '==', duration_ms)
      .where('score', '>', score)
      .count().get();
    allTimeRank = betterSnap.data().count + 1;
  }

  // Get daily rank (past 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let dailyRank = 1;
  if (is67Reps) {
    const betterDailySnap = await db.collection('scores')
      .where('duration_ms', '==', duration_ms)
      .where('created_at', '>=', twentyFourHoursAgo)
      .where('score', '<', score)
      .count().get();
    dailyRank = betterDailySnap.data().count + 1;
  } else {
    const betterDailySnap = await db.collection('scores')
      .where('duration_ms', '==', duration_ms)
      .where('created_at', '>=', twentyFourHoursAgo)
      .where('score', '>', score)
      .count().get();
    dailyRank = betterDailySnap.data().count + 1;
  }

  const percentile = totalCount ? Math.round((allTimeRank / totalCount) * 100) : 1;

  return { dailyRank, allTimeRank, percentile, totalCount };
}

export async function POST(request: NextRequest) {
  try {
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

    if (payload.mode !== 'duel') {
      return NextResponse.json({ error: 'Invalid token mode' }, { status: 400 });
    }

    if (!payload.duel_id || !payload.player_key) {
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

    // Update player score
    try {
      const playerSnap = await db.collection('duel_players')
        .where('duel_id', '==', payload.duel_id)
        .where('player_key', '==', payload.player_key)
        .get();

      if (!playerSnap.empty) {
        await playerSnap.docs[0].ref.update({
          score,
          submitted_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Score update error:', err);
      return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 });
    }

    // Check if both players have submitted
    const playersSnap = await db.collection('duel_players')
      .where('duel_id', '==', payload.duel_id)
      .get();

    const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      username: string;
      score: number | null;
      player_key: string;
      uid?: string;
      photoURL?: string | null;
    }>;

    const allSubmitted = players.every(p => p.score !== null && p.score !== undefined);

    if (allSubmitted && players.length > 0) {
      // Mark duel as complete
      await db.collection('duels').doc(payload.duel_id).update({ status: 'complete' });

      // Get duel info to check mode
      const duelDoc = await db.collection('duels').doc(payload.duel_id).get();
      const duel = duelDoc.exists ? (duelDoc.data() as { duration_ms: number }) : null;

      const is67Reps = duel && is67RepsMode(duel.duration_ms);

      // Determine winner
      const myPlayer = players.find(p => p.player_key === payload.player_key);
      const opponent = players.find(p => p.player_key !== payload.player_key);

      let outcome: 'win' | 'lose' | 'tie' = 'tie';
      if (myPlayer && opponent && myPlayer.score !== null && opponent.score !== null) {
        if (is67Reps) {
          // 67 reps mode: lower time (score) wins
          if (myPlayer.score < opponent.score) outcome = 'win';
          else if (myPlayer.score > opponent.score) outcome = 'lose';
        } else {
          // Timed mode: higher reps (score) wins
          if (myPlayer.score > opponent.score) outcome = 'win';
          else if (myPlayer.score < opponent.score) outcome = 'lose';
        }
      }

      // Save scores to leaderboard for standard durations
      const isStandardDuration = duel && (
        duel.duration_ms === DURATION_6_7S || 
        duel.duration_ms === DURATION_20S || 
        duel.duration_ms === DURATION_67_REPS
      );

      let myRankStats = null;
      let opponentRankStats = null;

      if (isStandardDuration && duel && myPlayer && opponent && myPlayer.score !== null && opponent.score !== null) {
        // Insert both players' scores into the leaderboard
        const batch = db.batch();
        batch.set(db.collection('scores').doc(), {
          username: myPlayer.username,
          score: myPlayer.score,
          duration_ms: duel.duration_ms,
          uid: myPlayer.uid || null,
          photoURL: myPlayer.photoURL || null,
          created_at: new Date().toISOString()
        });
        batch.set(db.collection('scores').doc(), {
          username: opponent.username,
          score: opponent.score,
          duration_ms: duel.duration_ms,
          uid: opponent.uid || null,
          photoURL: opponent.photoURL || null,
          created_at: new Date().toISOString()
        });
        await batch.commit();

        // Calculate rank stats for both players
        myRankStats = await calculateRankStats(duel.duration_ms, myPlayer.score, !!is67Reps);
        opponentRankStats = await calculateRankStats(duel.duration_ms, opponent.score, !!is67Reps);
      }

      return NextResponse.json({
        status: 'complete',
        result: {
          myScore: myPlayer?.score,
          myUsername: myPlayer?.username,
          opponentScore: opponent?.score,
          opponentUsername: opponent?.username,
          outcome,
          myRankStats,
          opponentRankStats
        }
      });
    }

    return NextResponse.json({ status: 'waiting' });
  } catch (error) {
    console.error('Duel submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
