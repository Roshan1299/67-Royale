import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queueId } = body;

    if (!queueId || typeof queueId !== 'string') {
      return NextResponse.json({ error: 'queueId is required' }, { status: 400 });
    }

    const db = getDb();
    const doc = await db.collection('matchmaking_queue').doc(queueId).get();

    if (!doc.exists) {
      return NextResponse.json({ success: true }); // Already gone
    }

    await db.collection('matchmaking_queue').doc(queueId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Matchmaking leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
