import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const queueId = request.nextUrl.searchParams.get('queueId');

    if (!queueId) {
      return NextResponse.json({ error: 'queueId is required' }, { status: 400 });
    }

    const db = getDb();
    const doc = await db.collection('matchmaking_queue').doc(queueId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
    }

    const data = doc.data()!;

    if (data.status === 'matched' && data.matched_duel_id) {
      return NextResponse.json({
        status: 'matched',
        duelId: data.matched_duel_id,
        player_key: data.matched_player_key,
      });
    }

    return NextResponse.json({ status: 'waiting' });
  } catch (error) {
    console.error('Matchmaking status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
