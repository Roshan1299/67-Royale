import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
import { DURATION_6_7S, DURATION_20S, DURATION_67_REPS, LeaderboardEntry, is67RepsMode } from '@/types/game';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const durationParam = searchParams.get('duration_ms');
    const timeframe = searchParams.get('timeframe') || 'daily';

    // Validate duration parameter
    if (!durationParam) {
      return NextResponse.json(
        { error: 'duration_ms query parameter is required' },
        { status: 400 }
      );
    }

    const duration = parseInt(durationParam, 10);
    if (duration !== DURATION_6_7S && duration !== DURATION_20S && duration !== DURATION_67_REPS) {
      return NextResponse.json(
        { error: 'duration_ms must be 6700, 20000, or -1 (67 reps)' },
        { status: 400 }
      );
    }

    const db = getDb();
    const is67Reps = is67RepsMode(duration);

    // Build query
    let query: FirebaseFirestore.Query = db.collection('scores')
      .where('duration_ms', '==', duration);

    // Filter by timeframe if daily
    if (timeframe === 'daily') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.where('created_at', '>=', twentyFourHoursAgo);
    }

    // Fetch top 100 scores for the specified duration
    // For 67 reps mode: lower time is better (ASC)
    // For timed modes: higher reps is better (DESC)
    const snap = await query
      .orderBy('score', is67Reps ? 'asc' : 'desc')
      .orderBy('created_at', 'asc')
      .limit(100)
      .get();

    const scores = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as { id: string; username: string; score: number; created_at: string }[];

    // Calculate ranks (ties share the same rank)
    const entries: LeaderboardEntry[] = [];
    let currentRank = 1;
    let lastScore: number | null = null;
    let sameScoreCount = 0;

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      
      // For 67 reps (ASC), a higher score means worse rank
      // For timed modes (DESC), a lower score means worse rank
      const scoreChanged = is67Reps 
        ? (lastScore !== null && score.score > lastScore)
        : (lastScore !== null && score.score < lastScore);
      
      if (scoreChanged) {
        currentRank += sameScoreCount;
        sameScoreCount = 1;
      } else if (lastScore !== null && score.score === lastScore) {
        sameScoreCount++;
      } else {
        sameScoreCount = 1;
      }

      entries.push({
        id: score.id,
        username: score.username,
        score: score.score,
        rank: currentRank,
        created_at: score.created_at
      });

      lastScore = score.score;
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
