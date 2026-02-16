import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    const db = getDb();

    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    // Get participants
    const participantsSnap = await db.collection('tournament_participants')
      .where('tournament_id', '==', tournamentId)
      .get();

    const participants = participantsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get matches
    const matchesSnap = await db.collection('tournament_matches')
      .where('tournament_id', '==', tournamentId)
      .get();

    const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ tournament, participants, matches });
  } catch (error) {
    console.error('Tournament get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
