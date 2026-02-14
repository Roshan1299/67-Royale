import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
import { is67RepsMode } from '@/types/game';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const db = getDb();

    // Fetch the score
    const doc = await db.collection('scores').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Score not found' }, { status: 404 });
    }

    const score = { id: doc.id, ...doc.data() } as {
      id: string;
      username: string;
      score: number;
      duration_ms: number;
      created_at: string;
    };

    const is67Reps = is67RepsMode(score.duration_ms);

    // Get total players for all-time
    const totalSnap = await db.collection('scores')
      .where('duration_ms', '==', score.duration_ms)
      .count()
      .get();
    const totalPlayers = totalSnap.data().count;

    // Calculate all-time rank
    let allTimeRank = 1;
    if (is67Reps) {
      const betterSnap = await db.collection('scores')
        .where('duration_ms', '==', score.duration_ms)
        .where('score', '<', score.score)
        .count()
        .get();
      allTimeRank = betterSnap.data().count + 1;
    } else {
      const betterSnap = await db.collection('scores')
        .where('duration_ms', '==', score.duration_ms)
        .where('score', '>', score.score)
        .count()
        .get();
      allTimeRank = betterSnap.data().count + 1;
    }

    // Calculate daily rank (past 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let dailyRank = 1;
    if (is67Reps) {
      const betterDailySnap = await db.collection('scores')
        .where('duration_ms', '==', score.duration_ms)
        .where('created_at', '>=', twentyFourHoursAgo)
        .where('score', '<', score.score)
        .count()
        .get();
      dailyRank = betterDailySnap.data().count + 1;
    } else {
      const betterDailySnap = await db.collection('scores')
        .where('duration_ms', '==', score.duration_ms)
        .where('created_at', '>=', twentyFourHoursAgo)
        .where('score', '>', score.score)
        .count()
        .get();
      dailyRank = betterDailySnap.data().count + 1;
    }

    const percentile = totalPlayers ? Math.round((allTimeRank / totalPlayers) * 100) : 1;

    return NextResponse.json({
      ...score,
      dailyRank,
      allTimeRank,
      percentile,
      totalPlayers: totalPlayers || 0
    });
  } catch (error) {
    console.error('Score fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
