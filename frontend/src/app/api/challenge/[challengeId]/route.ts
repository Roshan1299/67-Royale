import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;

    if (!challengeId) {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
    }

    const db = getDb();

    // Get challenge details
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();

    if (!challengeDoc.exists) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const challenge = { id: challengeDoc.id, ...challengeDoc.data() } as {
      id: string;
      duration_ms: number;
      status: string;
      expires_at: string;
    };

    // Get entries
    const entriesSnap = await db
      .collection('challenge_entries')
      .where('challenge_id', '==', challengeId)
      .get();

    const entries = entriesSnap.docs.map(d => {
      const data = d.data() as { player_key: string; username: string; score: number; submitted_at?: string };
      return {
        player_key: data.player_key,
        username: data.username,
        score: data.score,
        submitted_at: data.submitted_at,
      };
    });

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        duration_ms: challenge.duration_ms,
        status: challenge.status,
        expires_at: new Date(challenge.expires_at).getTime()
      },
      entries: entries.map(e => ({
        player_key: e.player_key,
        username: e.username,
        score: e.score,
        submitted_at: e.submitted_at
      }))
    });
  } catch (error) {
    console.error('Challenge fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
