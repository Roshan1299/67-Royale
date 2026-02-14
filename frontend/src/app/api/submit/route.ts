import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, validateSubmissionTiming } from '@/lib/jwt';
import { checkRateLimit, createRateLimitKey } from '@/lib/rate-limit';
import { getDb } from '@/lib/firebase/server';
import { verifyAuthToken } from '@/lib/firebase/server';
import { DURATION_6_7S, DURATION_20S, DURATION_67_REPS, is67RepsMode } from '@/types/game';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, score } = body;

    // Validate required fields
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (typeof score !== 'number' || score < 0 || !Number.isInteger(score)) {
      return NextResponse.json({ error: 'Score must be a non-negative integer' }, { status: 400 });
    }

    // Verify Firebase auth token to get user identity
    let authUser;
    try {
      authUser = await verifyAuthToken(request);
    } catch (authError) {
      console.error('[Submit] Auth verification error:', authError);
      return NextResponse.json({ error: 'Authentication verification failed' }, { status: 500 });
    }

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const { uid, displayName: username, photoURL } = authUser;

    // Verify JWT token
    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Validate mode
    if (payload.mode !== 'normal') {
      return NextResponse.json({ error: 'Invalid token mode for this endpoint' }, { status: 400 });
    }

    // For 67 reps mode, we have different timing validation (no fixed duration)
    const is67Reps = is67RepsMode(payload.duration_ms);
    
    if (!is67Reps) {
      // Validate timing for timed modes
    const timingValidation = validateSubmissionTiming(payload, Date.now());
    if (!timingValidation.valid) {
      return NextResponse.json({ error: timingValidation.reason }, { status: 400 });
      }
    }

    // Only allow leaderboard submissions for standard durations
    if (payload.duration_ms !== DURATION_6_7S && payload.duration_ms !== DURATION_20S && payload.duration_ms !== DURATION_67_REPS) {
      return NextResponse.json(
        { error: 'Only 6.7s, 20s, and 67 Reps rounds can be submitted to the leaderboard' },
        { status: 400 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const rateLimitKey = createRateLimitKey(ip);
    const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 10000, maxRequests: 1 });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rateLimit.retryAfter} seconds` },
        { status: 429 }
      );
    }

    // Insert score into database
    // For 67 reps mode, score is elapsed time in ms
    // For timed modes, score is rep count
    const db = getDb();
    const docRef = await db.collection('scores').add({
      username,
      uid,
      photoURL,
      score,
      duration_ms: payload.duration_ms,
      created_at: new Date().toISOString(),
    });
    const scoreId = docRef.id;

    // Also update user_stats with username/photoURL (for PvP leaderboard display)
    // This ensures users appear correctly in PvP leaderboard even if they haven't played PvP yet
    try {
      await db.collection('user_stats').doc(uid).set({
        username: username || null,
        photoURL: photoURL || null,
      }, { merge: true });
    } catch (err) {
      console.error('Failed to update user_stats:', err);
      // Don't fail the submission if this fails
    }

    // Calculate ranks and percentile
    // Wrap in try-catch to handle missing indexes gracefully
    let dailyRank, allTimeRank, percentile, totalCount;

    try {
      // Get total count for all-time
      const totalCountSnap = await db.collection('scores')
        .where('duration_ms', '==', payload.duration_ms)
        .count()
        .get();
      totalCount = totalCountSnap.data().count;

      // Get all-time rank (count of better scores + 1)
      allTimeRank = 1;
      if (is67Reps) {
        const betterSnap = await db.collection('scores')
          .where('duration_ms', '==', payload.duration_ms)
          .where('score', '<', score)
          .count()
          .get();
        allTimeRank = betterSnap.data().count + 1;
      } else {
        const betterSnap = await db.collection('scores')
          .where('duration_ms', '==', payload.duration_ms)
          .where('score', '>', score)
          .count()
          .get();
        allTimeRank = betterSnap.data().count + 1;
      }

      // Get daily rank (past 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      dailyRank = 1;
      if (is67Reps) {
        const betterDailySnap = await db.collection('scores')
          .where('duration_ms', '==', payload.duration_ms)
          .where('created_at', '>=', twentyFourHoursAgo)
          .where('score', '<', score)
          .count()
          .get();
        dailyRank = betterDailySnap.data().count + 1;
      } else {
        const betterDailySnap = await db.collection('scores')
          .where('duration_ms', '==', payload.duration_ms)
          .where('created_at', '>=', twentyFourHoursAgo)
          .where('score', '>', score)
          .count()
          .get();
        dailyRank = betterDailySnap.data().count + 1;
      }

      percentile = totalCount ? Math.round((allTimeRank / totalCount) * 100) : 1;
    } catch (rankError: unknown) {
      // If index is missing, log the error but still allow the submission to succeed
      const errorMsg = rankError instanceof Error ? rankError.message : String(rankError);
      console.error('[Submit] Rank calculation failed (missing index?):', errorMsg);

      // Extract index creation URL if present
      if (errorMsg.includes('console.firebase.google.com')) {
        const match = errorMsg.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/);
        if (match) {
          console.error('[Submit] Create index here:', match[1]);
        }
      }

      // Return null ranks - the frontend will handle this gracefully
      dailyRank = undefined;
      allTimeRank = undefined;
      percentile = undefined;
      totalCount = 0;
    }

    return NextResponse.json({
      scoreId,
      dailyRank,
      allTimeRank,
      percentile,
      totalCount
    });
  } catch (error) {
    console.error('[Submit] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Submit] Error details:', errorMessage);
    return NextResponse.json({
      error: 'Failed to submit score. Please try again.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
