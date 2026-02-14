import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET() {
  try {
    const db = getDb();

    // Get total number of games played (both solo and duel scores are in the scores table)
    const snap = await db.collection('scores').count().get();
    const totalGames = snap.data().count;

    return NextResponse.json({
      totalGames: totalGames || 0
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
