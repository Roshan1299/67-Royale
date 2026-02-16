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

    // Get tournament
    const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
    if (!tournamentDoc.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournamentDoc.data()!;
    if (tournament.status !== 'registration') {
      return NextResponse.json({ error: 'Tournament is not accepting registrations' }, { status: 400 });
    }

    // Check if already joined
    const existingSnap = await db.collection('tournament_participants')
      .where('tournament_id', '==', tournament_id)
      .where('uid', '==', user.uid)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'Already registered' }, { status: 400 });
    }

    // Check capacity
    const participantsSnap = await db.collection('tournament_participants')
      .where('tournament_id', '==', tournament_id)
      .get();

    if (participantsSnap.size >= tournament.max_players) {
      return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });
    }

    await db.collection('tournament_participants').add({
      tournament_id,
      uid: user.uid,
      username: user.displayName,
      photoURL: user.photoURL,
      seed: 0,
      status: 'active',
      eliminated_round: null,
      registered_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tournament join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
