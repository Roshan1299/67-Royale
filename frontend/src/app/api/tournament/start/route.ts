import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';

interface Participant {
  id: string;
  uid: string;
  username: string;
  photoURL: string | null;
}

// Standard bracket seeding order for 8 slots: 1v8, 4v5, 2v7, 3v6
// For 16 slots: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
function getBracketOrder(size: number): number[] {
  if (size === 2) return [0, 1];
  const half = getBracketOrder(size / 2);
  const result: number[] = [];
  for (const h of half) {
    result.push(h);
    result.push(size - 1 - h);
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { tournament_id } = body;

    if (!tournament_id || typeof tournament_id !== 'string') {
      return NextResponse.json({ error: 'tournament_id is required' }, { status: 400 });
    }

    const db = getDb();

    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournamentDoc.data()!;
    if (tournament.created_by !== user.uid) {
      return NextResponse.json({ error: 'Only the creator can start the tournament' }, { status: 403 });
    }

    if (tournament.status !== 'registration') {
      return NextResponse.json({ error: 'Tournament already started' }, { status: 400 });
    }

    // Get participants
    const participantsSnap = await db.collection('tournament_participants')
      .where('tournament_id', '==', tournament_id)
      .get();

    const participants: Participant[] = participantsSnap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Participant, 'id'>),
    }));

    if (participants.length < 3) {
      return NextResponse.json({ error: 'Need at least 3 players to start' }, { status: 400 });
    }

    // Shuffle participants for random seeding
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }

    // Assign seeds
    const batch = db.batch();
    participants.forEach((p, i) => {
      batch.update(db.collection('tournament_participants').doc(p.id), { seed: i + 1 });
    });

    // Calculate bracket size (next power of 2)
    const bracketSize = tournament.max_players as number; // 8 or 16
    const totalRounds = tournament.total_rounds as number;

    // Create slots array: participants + BYEs
    const slots: (Participant | null)[] = [];
    const bracketOrder = getBracketOrder(bracketSize);
    for (const idx of bracketOrder) {
      slots.push(idx < participants.length ? participants[idx] : null);
    }

    // Generate all match documents
    // matchesByRound[round] = array of match refs
    const matchIdsByRound: string[][] = [];

    // Create matches for all rounds (empty first, then link)
    for (let round = 1; round <= totalRounds; round++) {
      const matchCount = bracketSize / Math.pow(2, round);
      const roundMatchIds: string[] = [];
      for (let m = 0; m < matchCount; m++) {
        const ref = db.collection('tournament_matches').doc();
        roundMatchIds.push(ref.id);
      }
      matchIdsByRound.push(roundMatchIds);
    }

    // Now create match documents with proper linking
    for (let round = 1; round <= totalRounds; round++) {
      const roundIdx = round - 1;
      const matchIds = matchIdsByRound[roundIdx];
      const nextRoundIds = roundIdx + 1 < matchIdsByRound.length ? matchIdsByRound[roundIdx + 1] : null;

      for (let m = 0; m < matchIds.length; m++) {
        const nextMatchId = nextRoundIds ? nextRoundIds[Math.floor(m / 2)] : null;

        if (round === 1) {
          // First round: populate from slots
          const p1 = slots[m * 2];
          const p2 = slots[m * 2 + 1];

          const isBye = !p1 || !p2;
          let status: 'pending' | 'ready' | 'complete' = 'pending';
          let winnerUid: string | null = null;

          if (isBye) {
            // Auto-advance the non-null player
            const winner = p1 || p2;
            if (winner) {
              status = 'complete';
              winnerUid = winner.uid;
            }
          } else {
            status = 'ready';
          }

          batch.set(db.collection('tournament_matches').doc(matchIds[m]), {
            tournament_id,
            round,
            match_number: m,
            player1_uid: p1?.uid || null,
            player1_username: p1?.username || null,
            player1_photoURL: p1?.photoURL || null,
            player2_uid: p2?.uid || null,
            player2_username: p2?.username || null,
            player2_photoURL: p2?.photoURL || null,
            winner_uid: winnerUid,
            duel_id: null,
            status,
            player1_score: null,
            player2_score: null,
            next_match_id: nextMatchId,
          });
        } else {
          // Later rounds: empty matches
          batch.set(db.collection('tournament_matches').doc(matchIds[m]), {
            tournament_id,
            round,
            match_number: m,
            player1_uid: null,
            player1_username: null,
            player1_photoURL: null,
            player2_uid: null,
            player2_username: null,
            player2_photoURL: null,
            winner_uid: null,
            duel_id: null,
            status: 'pending',
            player1_score: null,
            player2_score: null,
            next_match_id: nextMatchId,
          });
        }
      }
    }

    // Update tournament status
    batch.update(db.collection('tournaments').doc(tournament_id), {
      status: 'active',
      current_round: 1,
      started_at: new Date().toISOString(),
    });

    await batch.commit();

    // After commit, advance BYE winners to next round
    // Need to read the round 1 matches and propagate BYE winners
    const round1Matches = await db.collection('tournament_matches')
      .where('tournament_id', '==', tournament_id)
      .where('round', '==', 1)
      .get();

    for (const matchDoc of round1Matches.docs) {
      const match = matchDoc.data();
      if (match.status === 'complete' && match.winner_uid && match.next_match_id) {
        await advanceWinner(db, match.next_match_id, match.winner_uid, match.match_number);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tournament start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Advance winner to next match
async function advanceWinner(
  db: FirebaseFirestore.Firestore,
  nextMatchId: string,
  winnerUid: string,
  fromMatchNumber: number,
) {
  const nextMatchDoc = await db.collection('tournament_matches').doc(nextMatchId).get();
  if (!nextMatchDoc.exists) return;

  // Get winner info from participants
  const participantSnap = await db.collection('tournament_participants')
    .where('uid', '==', winnerUid)
    .limit(1)
    .get();

  if (participantSnap.empty) return;

  const participant = participantSnap.docs[0].data();
  const isSlot1 = fromMatchNumber % 2 === 0;

  const update: Record<string, unknown> = {};
  if (isSlot1) {
    update.player1_uid = winnerUid;
    update.player1_username = participant.username;
    update.player1_photoURL = participant.photoURL;
  } else {
    update.player2_uid = winnerUid;
    update.player2_username = participant.username;
    update.player2_photoURL = participant.photoURL;
  }

  await db.collection('tournament_matches').doc(nextMatchId).update(update);

  // Check if both players are now present → set ready
  const refreshed = await db.collection('tournament_matches').doc(nextMatchId).get();
  const data = refreshed.data()!;
  if (data.player1_uid && data.player2_uid && data.status === 'pending') {
    await db.collection('tournament_matches').doc(nextMatchId).update({ status: 'ready' });
  }

  // If the other slot is empty AND this is a BYE propagation,
  // check if the other feeder match is also a BYE (complete with no opponent)
  // This handles cascading BYEs
  if (data.player1_uid && !data.player2_uid && data.status === 'pending') {
    // Check if feeder match for slot 2 exists and is a BYE
    // We can't easily check this here, so we leave it for the polling to resolve
  }
}
