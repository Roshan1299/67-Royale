import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ duelId: string }> }
) {
  try {
    const { duelId } = await params;

    if (!duelId) {
      return NextResponse.json({ error: 'duelId is required' }, { status: 400 });
    }

    const db = getDb();

    // Get duel details
    const duelDoc = await db.collection('duels').doc(duelId).get();
    if (!duelDoc.exists) {
      return NextResponse.json({ error: 'Duel not found' }, { status: 404 });
    }

    const duel = { id: duelDoc.id, ...duelDoc.data() } as {
      id: string;
      duration_ms: number;
      status: string;
      start_at: string | null;
      expires_at: string;
      lobby_code?: string;
    };

    // Get players
    const playersSnap = await db.collection('duel_players')
      .where('duel_id', '==', duelId)
      .get();

    const players = playersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.id.localeCompare(b.id)) as Array<{
        id: string;
        player_key: string;
        username: string;
        ready: boolean;
        score: number | null;
      }>;

    // Calculate rank stats if duel is complete and it's a standard duration
    const isStandardDuration =
      duel.duration_ms === DURATION_6_7S ||
      duel.duration_ms === DURATION_20S ||
      duel.duration_ms === DURATION_67_REPS;

    const is67Reps = is67RepsMode(duel.duration_ms);

    const rankStats: Record<string, { dailyRank: number; allTimeRank: number; percentile: number; totalCount: number }> = {};

    if (duel.status === 'complete' && isStandardDuration) {
      for (const player of players) {
        if (player.score !== null) {
          try {
            rankStats[player.player_key] = await calculateRankStats(
              duel.duration_ms,
              player.score,
              is67Reps
            );
          } catch (err) {
            console.error('Rank stats calculation failed (missing index?):', err);
            // Don't crash the API - just skip rank stats for this player
          }
        }
      }
    }

    return NextResponse.json({
      duel: {
        id: duel.id,
        duration_ms: duel.duration_ms,
        status: duel.status,
        lobby_code: duel.lobby_code || null,
        start_at: duel.start_at ? new Date(duel.start_at).getTime() : null,
        expires_at: new Date(duel.expires_at).getTime()
      },
      players: players.map(p => ({
        player_key: p.player_key,
        username: p.username,
        ready: p.ready,
        score: p.score,
        rankStats: rankStats[p.player_key] || null
      }))
    });
  } catch (error) {
    console.error('Duel fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
