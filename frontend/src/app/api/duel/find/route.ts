import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim();

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'A 6-digit lobby code is required' }, { status: 400 });
    }

    const db = getDb();

    const snapshot = await db.collection('duels')
      .where('lobby_code', '==', code)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Lobby not found or already started' }, { status: 404 });
    }

    const duelDoc = snapshot.docs[0];

    // Check if expired
    const expiresAt = new Date(duelDoc.data().expires_at).getTime();
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: 'This lobby has expired' }, { status: 404 });
    }

    return NextResponse.json({ duelId: duelDoc.id });
  } catch (error) {
    console.error('Duel find error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
