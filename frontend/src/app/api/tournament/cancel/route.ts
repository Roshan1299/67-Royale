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

    if (tournament.created_by !== user.uid) {
      return NextResponse.json({ error: 'Only the host can cancel the tournament' }, { status: 403 });
    }

    if (tournament.status === 'complete' || tournament.status === 'cancelled') {
      return NextResponse.json({ error: 'Tournament is already finished' }, { status: 400 });
    }

    // Cancel the tournament
    await db.collection('tournaments').doc(tournament_id).update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    });

    // If active, mark all non-complete matches as cancelled (pending status)
    if (tournament.status === 'active') {
      const matchesSnap = await db.collection('tournament_matches')
        .where('tournament_id', '==', tournament_id)
        .get();

      const batch = db.batch();
      for (const doc of matchesSnap.docs) {
        const match = doc.data();
        if (match.status !== 'complete') {
          batch.update(doc.ref, { status: 'pending' });
        }
      }
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tournament cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
