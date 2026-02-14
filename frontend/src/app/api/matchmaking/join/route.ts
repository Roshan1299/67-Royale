import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { STANDARD_DURATIONS } from '@/types/game';
import { randomUUID } from 'crypto';

const QUEUE_STALE_MS = 2 * 60 * 1000; // 2 minutes
const DUEL_EXPIRY_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { duration_ms } = body;

    // Only allow standard durations for matchmaking
    if (!STANDARD_DURATIONS.includes(duration_ms)) {
      return NextResponse.json(
        { error: 'Only standard durations (6.7s, 20s, 67 Reps) are allowed for matchmaking' },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - QUEUE_STALE_MS).toISOString();

    // Look for a waiting player with same duration (not ourselves)
    const queueSnap = await db.collection('matchmaking_queue')
      .where('duration_ms', '==', duration_ms)
      .where('status', '==', 'waiting')
      .limit(10)
      .get();

    // Find a valid match (not stale, not ourselves)
    let matchDoc: { id: string; uid: string; username: string; photoURL: string | null } | null = null;
    for (const doc of queueSnap.docs) {
      const data = doc.data();
      if (data.uid === user.uid) continue; // Skip ourselves
      if (data.created_at < staleThreshold) continue; // Skip stale entries
      matchDoc = { id: doc.id, uid: data.uid, username: data.username, photoURL: data.photoURL };
      break;
    }

    if (matchDoc) {
      // Match found — create duel with both players auto-ready and active
      const expiresAt = new Date(now.getTime() + DUEL_EXPIRY_MINUTES * 60 * 1000);
      const startAt = new Date(now.getTime() + 5000); // 5s from now for sync

      const playerKeyA = randomUUID();
      const playerKeyB = randomUUID();

      // Create duel as active (skip lobby)
      const duelRef = await db.collection('duels').add({
        duration_ms,
        status: 'active',
        lobby_code: null,
        start_at: startAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        matchmade: true,
      });

      const duelId = duelRef.id;

      // Add both players as ready
      await Promise.all([
        db.collection('duel_players').add({
          duel_id: duelId,
          player_key: playerKeyA,
          username: matchDoc.username,
          uid: matchDoc.uid,
          photoURL: matchDoc.photoURL || null,
          ready: true,
        }),
        db.collection('duel_players').add({
          duel_id: duelId,
          player_key: playerKeyB,
          username: user.displayName,
          uid: user.uid,
          photoURL: user.photoURL || null,
          ready: true,
        }),
      ]);

      // Update matched player's queue entry and delete it
      await db.collection('matchmaking_queue').doc(matchDoc.id).update({
        status: 'matched',
        matched_duel_id: duelId,
        matched_player_key: playerKeyA,
      });

      // Store player B's key in session (returned to caller)
      return NextResponse.json({
        status: 'matched',
        duelId,
        player_key: playerKeyB,
      });
    }

    // No match — check if we already have a waiting entry
    const existingSnap = await db.collection('matchmaking_queue')
      .where('uid', '==', user.uid)
      .where('status', '==', 'waiting')
      .where('duration_ms', '==', duration_ms)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      // Refresh the timestamp
      await existing.ref.update({ created_at: now.toISOString() });
      return NextResponse.json({
        status: 'waiting',
        queueId: existing.id,
      });
    }

    // Add to queue
    const queueRef = await db.collection('matchmaking_queue').add({
      uid: user.uid,
      username: user.displayName,
      photoURL: user.photoURL || null,
      duration_ms,
      status: 'waiting',
      created_at: now.toISOString(),
      matched_duel_id: null,
      matched_player_key: null,
    });

    return NextResponse.json({
      status: 'waiting',
      queueId: queueRef.id,
    });
  } catch (error) {
    console.error('Matchmaking join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
