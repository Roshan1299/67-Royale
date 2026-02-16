import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { tournament_id, match_id } = body;

    if (!tournament_id || !match_id) {
      return NextResponse.json({ error: 'tournament_id and match_id are required' }, { status: 400 });
    }

    const db = getDb();

    // Get tournament
    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    const tournament = tournamentDoc.data()!;

    // Get match
    const matchDoc = await db.collection('tournament_matches').doc(match_id).get();
    if (!matchDoc.exists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    const match = matchDoc.data()!;

    // Verify user is a player in this match
    const isPlayer1 = match.player1_uid === user.uid;
    const isPlayer2 = match.player2_uid === user.uid;
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'You are not a player in this match' }, { status: 403 });
    }

    if (match.status !== 'ready' && match.status !== 'active') {
      return NextResponse.json({ error: 'Match is not available' }, { status: 400 });
    }

    // If duel already created, return it (allows both players to get their keys)
    if (match.duel_id) {
      // Find the player's key
      const playerSnap = await db.collection('duel_players')
        .where('duel_id', '==', match.duel_id)
        .where('uid', '==', user.uid)
        .get();

      if (!playerSnap.empty) {
        return NextResponse.json({
          duelId: match.duel_id,
          player_key: playerSnap.docs[0].data().player_key,
        });
      }
    }

    // Create a duel for this tournament match (waiting status - lobby first)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const duelRef = await db.collection('duels').add({
      duration_ms: tournament.duration_ms,
      status: 'waiting',
      start_at: null,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      tournament_id,
      tournament_match_id: match_id,
    });

    const player1Key = randomUUID();
    const player2Key = randomUUID();

    // Add both players (not ready yet - they must ready up in lobby)
    await Promise.all([
      db.collection('duel_players').add({
        duel_id: duelRef.id,
        player_key: player1Key,
        username: match.player1_username,
        uid: match.player1_uid,
        photoURL: match.player1_photoURL,
        ready: false,
        score: null,
        submitted_at: null,
      }),
      db.collection('duel_players').add({
        duel_id: duelRef.id,
        player_key: player2Key,
        username: match.player2_username,
        uid: match.player2_uid,
        photoURL: match.player2_photoURL,
        ready: false,
        score: null,
        submitted_at: null,
      }),
    ]);

    // Update match with duel_id and set to active
    await db.collection('tournament_matches').doc(match_id).update({
      duel_id: duelRef.id,
      status: 'active',
    });

    const myPlayerKey = isPlayer1 ? player1Key : player2Key;

    return NextResponse.json({
      duelId: duelRef.id,
      player_key: myPlayerKey,
    });
  } catch (error) {
    console.error('Tournament match start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
