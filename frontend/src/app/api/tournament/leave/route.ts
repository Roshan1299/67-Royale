import { NextRequest, NextResponse } from 'next/server';
import { getDb, verifyAuthToken } from '@/lib/firebase/server';

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

    // Can only leave during registration
    if (tournament.status !== 'registration') {
      return NextResponse.json({ error: 'Cannot leave a tournament that has already started' }, { status: 400 });
    }

    // Host cannot leave — they should cancel instead
    if (tournament.created_by === user.uid) {
      return NextResponse.json({ error: 'Host cannot leave. Cancel the tournament instead.' }, { status: 400 });
    }

    // Find and delete participant
    const participantSnap = await db.collection('tournament_participants')
      .where('tournament_id', '==', tournament_id)
      .where('uid', '==', user.uid)
      .get();

    if (participantSnap.empty) {
      return NextResponse.json({ error: 'You are not in this tournament' }, { status: 400 });
    }

    await participantSnap.docs[0].ref.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tournament leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
