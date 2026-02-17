import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';
import { verifySessionToken, validateSubmissionTiming } from '@/lib/jwt';
import { checkRateLimit, createRateLimitKey } from '@/lib/rate-limit';
import { is67RepsMode, DURATION_6_7S, DURATION_20S, DURATION_67_REPS } from '@/types/game';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

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

// Handle tournament match completion
async function handleTournamentMatchCompletion(
  db: Firestore,
  duelData: Record<string, unknown>,
  winnerUid: string,
  loserUid: string,
  scores: Map<string, number>, // Map of uid -> score
) {
  const tournamentMatchId = duelData.tournament_match_id as string | undefined;
  const tournamentId = duelData.tournament_id as string | undefined;
  if (!tournamentMatchId || !tournamentId) return;

  try {
    const matchDoc = await db.collection('tournament_matches').doc(tournamentMatchId).get();
    if (!matchDoc.exists) return;
    const match = matchDoc.data()!;

    // Map scores by UID to ensure correct assignment
    const player1Score = scores.get(match.player1_uid) ?? 0;
    const player2Score = scores.get(match.player2_uid) ?? 0;

    // Update match with scores and winner
    await db.collection('tournament_matches').doc(tournamentMatchId).update({
      status: 'complete',
      winner_uid: winnerUid,
      player1_score: player1Score,
      player2_score: player2Score,
    });

    // Eliminate the loser
    const loserSnap = await db.collection('tournament_participants')
      .where('tournament_id', '==', tournamentId)
      .where('uid', '==', loserUid)
      .limit(1)
      .get();
    if (!loserSnap.empty) {
      await loserSnap.docs[0].ref.update({
        status: 'eliminated',
        eliminated_round: match.round,
      });
    }

    // Advance winner to next match
    if (match.next_match_id) {
      const nextMatchDoc = await db.collection('tournament_matches').doc(match.next_match_id).get();
      if (nextMatchDoc.exists) {
        // Get winner info
        const winnerSnap = await db.collection('tournament_participants')
          .where('tournament_id', '==', tournamentId)
          .where('uid', '==', winnerUid)
          .limit(1)
          .get();

        if (!winnerSnap.empty) {
          const winner = winnerSnap.docs[0].data();
          const isSlot1 = match.match_number % 2 === 0;
          const update: Record<string, unknown> = {};

          if (isSlot1) {
            update.player1_uid = winnerUid;
            update.player1_username = winner.username;
            update.player1_photoURL = winner.photoURL;
          } else {
            update.player2_uid = winnerUid;
            update.player2_username = winner.username;
            update.player2_photoURL = winner.photoURL;
          }

          await db.collection('tournament_matches').doc(match.next_match_id).update(update);

          // Check if both players present → set ready
          const refreshed = await db.collection('tournament_matches').doc(match.next_match_id).get();
          const nextData = refreshed.data()!;
          if (nextData.player1_uid && nextData.player2_uid && nextData.status === 'pending') {
            await db.collection('tournament_matches').doc(match.next_match_id).update({ status: 'ready' });
          }
        }
      }
    } else {
      // This was the final match — tournament complete!
      const winnerSnap = await db.collection('tournament_participants')
        .where('tournament_id', '==', tournamentId)
        .where('uid', '==', winnerUid)
        .limit(1)
        .get();

      const winnerUsername = winnerSnap.empty ? 'Unknown' : winnerSnap.docs[0].data().username;

      await db.collection('tournaments').doc(tournamentId).update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        winner_uid: winnerUid,
        winner_username: winnerUsername,
      });

      // Award trophies
      const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
      const totalRounds = tournamentDoc.data()?.total_rounds || 3;

      // Winner: +100, Runner-up: +50, Semifinalists: +20
      const trophyAwards: { uid: string; amount: number }[] = [
        { uid: winnerUid, amount: 100 },
        { uid: loserUid, amount: 50 },
      ];

      // Find semifinalists (eliminated in the round before final)
      const semiSnap = await db.collection('tournament_participants')
        .where('tournament_id', '==', tournamentId)
        .where('eliminated_round', '==', totalRounds - 1)
        .get();

      for (const doc of semiSnap.docs) {
        trophyAwards.push({ uid: doc.data().uid, amount: 20 });
      }

      for (const award of trophyAwards) {
        const ref = db.collection('user_stats').doc(award.uid);
        await ref.set(
          { trophies: FieldValue.increment(award.amount) },
          { merge: true }
        );
      }
    }

    // Update current_round on the tournament
    const allMatches = await db.collection('tournament_matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    let maxActiveRound = 1;
    for (const doc of allMatches.docs) {
      const m = doc.data();
      if ((m.status === 'ready' || m.status === 'active') && m.round > maxActiveRound) {
        maxActiveRound = m.round;
      }
    }

    await db.collection('tournaments').doc(tournamentId).update({
      current_round: maxActiveRound,
    });
  } catch (err) {
    console.error('Tournament match completion error:', err);
  }
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

        // Calculate rank stats for both players (may fail if indexes not created yet)
        try {
          myRankStats = await calculateRankStats(duel.duration_ms, myPlayer.score, !!is67Reps);
        } catch (err) {
          console.error('My rank stats failed (missing index?):', err);
        }
        try {
          opponentRankStats = await calculateRankStats(duel.duration_ms, opponent.score, !!is67Reps);
        } catch (err) {
          console.error('Opponent rank stats failed (missing index?):', err);
        }
      }

      // Update trophies for matchmade (PvP) duels (use trophies_awarded flag to prevent double-award race condition)
      let myTrophyDelta: number | null = null;
      let opponentTrophyDelta: number | null = null;

      if (duel && (duel as Record<string, unknown>).matchmade === true && !(duel as Record<string, unknown>).trophies_awarded && myPlayer && opponent) {
        // Atomically set trophies_awarded to prevent the other submitter from also awarding
        const duelRef = db.collection('duels').doc(payload.duel_id);
        const txResult = await db.runTransaction(async (tx) => {
          const snap = await tx.get(duelRef);
          if (snap.data()?.trophies_awarded) return false;
          tx.update(duelRef, { trophies_awarded: true });
          return true;
        });
        if (txResult) try {
          const TROPHY_WIN = 30;
          const TROPHY_LOSE = -15;

          const getPlayerOutcome = (p1Score: number | null, p2Score: number | null): number => {
            if (p1Score === null || p2Score === null) return 0;
            if (is67Reps) {
              if (p1Score < p2Score) return TROPHY_WIN;
              if (p1Score > p2Score) return TROPHY_LOSE;
            } else {
              if (p1Score > p2Score) return TROPHY_WIN;
              if (p1Score < p2Score) return TROPHY_LOSE;
            }
            return 0; // tie
          };

          myTrophyDelta = getPlayerOutcome(myPlayer.score, opponent.score);
          opponentTrophyDelta = getPlayerOutcome(opponent.score, myPlayer.score);

          const updateTrophies = async (uid: string, delta: number, username: string, photoURL: string | null | undefined) => {
            if (delta === 0) {
              // Still merge profile data even if no trophy change
              const ref = db.collection('user_stats').doc(uid);
              await ref.set({ username: username || null, photoURL: photoURL || null }, { merge: true });
              return;
            }
            const ref = db.collection('user_stats').doc(uid);
            if (delta > 0) {
              await ref.set({ trophies: FieldValue.increment(delta), username: username || null, photoURL: photoURL || null }, { merge: true });
            } else {
              // Floor at 0: read current value, then set
              const snap = await ref.get();
              const current = snap.exists ? (snap.data()?.trophies ?? 0) : 0;
              const newVal = Math.max(0, current + delta);
              await ref.set({ trophies: newVal, username: username || null, photoURL: photoURL || null }, { merge: true });
            }
          };

          if (myPlayer.uid) await updateTrophies(myPlayer.uid, myTrophyDelta, myPlayer.username, myPlayer.photoURL);
          if (opponent.uid) await updateTrophies(opponent.uid, opponentTrophyDelta, opponent.username, opponent.photoURL);
        } catch (err) {
          console.error('Trophy update failed:', err);
        }
      }

      // Tournament match completion hook
      if (duel && (duel as Record<string, unknown>).tournament_match_id && myPlayer && opponent) {
        const duelData = duel as Record<string, unknown>;
        // Determine absolute winner (not relative to submitter)
        let absoluteWinner: string | null = null;
        let absoluteLoser: string | null = null;
        if (myPlayer.score !== null && opponent.score !== null) {
          if (is67Reps) {
            absoluteWinner = myPlayer.score < opponent.score ? (myPlayer.uid || '') : (opponent.uid || '');
            absoluteLoser = myPlayer.score < opponent.score ? (opponent.uid || '') : (myPlayer.uid || '');
          } else {
            absoluteWinner = myPlayer.score > opponent.score ? (myPlayer.uid || '') : (opponent.uid || '');
            absoluteLoser = myPlayer.score > opponent.score ? (opponent.uid || '') : (myPlayer.uid || '');
          }
          if (myPlayer.score === opponent.score) {
            // Tie: first submitter wins
            absoluteWinner = myPlayer.uid || '';
            absoluteLoser = opponent.uid || '';
          }
        }
        if (absoluteWinner && absoluteLoser) {
          // Create score map by UID
          const scoreMap = new Map<string, number>();
          if (myPlayer.uid) scoreMap.set(myPlayer.uid, myPlayer.score ?? 0);
          if (opponent.uid) scoreMap.set(opponent.uid, opponent.score ?? 0);

          await handleTournamentMatchCompletion(
            db, duelData, absoluteWinner, absoluteLoser, scoreMap
          );
        }
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
          opponentRankStats,
          myTrophyDelta,
          opponentTrophyDelta,
          matchmade: (duel as Record<string, unknown>)?.matchmade === true
        }
      });
    }

    return NextResponse.json({ status: 'waiting' });
  } catch (error) {
    console.error('Duel submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
