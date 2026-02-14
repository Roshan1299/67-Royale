import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid');

  if (!uid || typeof uid !== 'string') {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  }

  try {
    const db = getDb();
    const doc = await db.collection('user_stats').doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json({ trophies: 0 });
    }

    const data = doc.data();
    return NextResponse.json({ trophies: data?.trophies ?? 0 });
  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
