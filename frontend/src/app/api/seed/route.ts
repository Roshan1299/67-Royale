import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/server';

// Mock usernames
const USERNAMES = [
  'SpeedDemon', 'HandMaster', 'FlashFingers', 'RepKing', 'MotionBlur',
  'SwiftHands', 'TurboTwitch', 'BlazeRunner', 'NitroReps', 'VelocityVic',
  'AcePlayer', 'ProMotion', 'EliteGamer', 'ChampHands', 'RapidFire',
  'QuickDraw', 'FastTrack', 'LightningLou', 'ThunderClap', 'StormySteve',
  'BoltBrian', 'DashDan', 'ZoomZara', 'RushRita', 'JetJake',
  'TurboTom', 'NitroNina', 'BlitzBob', 'RocketRay', 'MeteorMike',
  'CometCarl', 'StreakSam', 'FlashFred', 'WhirlwindWill', 'CycloneCy',
  'GaleGina', 'WindyWanda', 'BreezyBen', 'GustavGust', 'TempestTed',
  'HurricaneHank', 'TornadoTina', 'TwisterTom', 'StormSally', 'ThunderTheo',
  'VortexVera', 'SwirlSid', 'SpinnerSue', 'WhizWalt', 'ZippyZoe'
];

const generateUID = () => 'mock_' + Math.random().toString(36).substring(2, 15);
const getAvatar = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;

export async function POST() {
  try {
    const db = getDb();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let scoreCount = 0;
    let statsCount = 0;

    // Add scores in batches
    for (const username of USERNAMES) {
      const uid = generateUID();
      const photoURL = getAvatar(username);

      // 6.7s mode
      const score67s = Math.floor(Math.random() * 70) + 15;
      await db.collection('scores').add({
        username,
        uid,
        photoURL,
        score: score67s,
        duration_ms: 6700,
        created_at: new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString(),
      });
      scoreCount++;

      // 20s mode
      const score20s = Math.floor(Math.random() * 210) + 40;
      await db.collection('scores').add({
        username,
        uid,
        photoURL,
        score: score20s,
        duration_ms: 20000,
        created_at: new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString(),
      });
      scoreCount++;

      // 67 reps mode
      const score67reps = Math.floor(Math.random() * 25000) + 5000;
      await db.collection('scores').add({
        username,
        uid,
        photoURL,
        score: score67reps,
        duration_ms: -1,
        created_at: new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString(),
      });
      scoreCount++;

      // PvP stats
      const totalGames = Math.floor(Math.random() * 50) + 10;
      const wins = Math.floor(Math.random() * totalGames);
      const losses = totalGames - wins;
      const trophies = Math.max(0, 100 + (wins * 30) - (losses * 15));

      await db.collection('user_stats').doc(uid).set({
        username,
        photoURL,
        trophies,
        wins,
        losses,
      });
      statsCount++;
    }

    return NextResponse.json({
      success: true,
      scores: scoreCount,
      stats: statsCount,
      message: `Added ${scoreCount} scores and ${statsCount} PvP stats`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 });
  }
}
