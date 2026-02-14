/**
 * Simple seed script that directly adds documents to Firestore
 * Run with: node scripts/seed-simple.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Firebase Admin with env vars
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

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

// Generate random UID
const generateUID = () => 'mock_' + Math.random().toString(36).substring(2, 15);

// Get avatar URL
const getAvatar = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;

async function seedScores() {
  console.log('🌱 Seeding leaderboard with mock data...\n');

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const batch = db.batch();
  let count = 0;

  for (const username of USERNAMES) {
    const uid = generateUID();
    const photoURL = getAvatar(username);

    // 6.7s mode (15-85 reps)
    const score67s = Math.floor(Math.random() * 70) + 15;
    batch.set(db.collection('scores').doc(), {
      username,
      uid,
      photoURL,
      score: score67s,
      duration_ms: 6700,
      created_at: new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString(),
    });
    count++;

    // 20s mode (40-250 reps)
    const score20s = Math.floor(Math.random() * 210) + 40;
    batch.set(db.collection('scores').doc(), {
      username,
      uid,
      photoURL,
      score: score20s,
      duration_ms: 20000,
      created_at: new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString(),
    });
    count++;

    // 67 reps mode (5-30s time)
    const score67reps = Math.floor(Math.random() * 25000) + 5000;
    batch.set(db.collection('scores').doc(), {
      username,
      uid,
      photoURL,
      score: score67reps,
      duration_ms: -1,
      created_at: new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✅ Added ${count} scores to leaderboard`);
}

async function seedPvPStats() {
  console.log('🎮 Seeding PvP stats...\n');

  const batch = db.batch();
  let count = 0;

  for (const username of USERNAMES) {
    const uid = generateUID();
    const photoURL = getAvatar(username);

    const totalGames = Math.floor(Math.random() * 50) + 10;
    const wins = Math.floor(Math.random() * totalGames);
    const losses = totalGames - wins;
    const trophies = Math.max(0, 100 + (wins * 30) - (losses * 15));

    batch.set(db.collection('user_stats').doc(uid), {
      username,
      photoURL,
      trophies,
      wins,
      losses,
    });
    count++;
  }

  await batch.commit();
  console.log(`✅ Added ${count} PvP player stats\n`);
}

async function main() {
  try {
    await seedScores();
    await seedPvPStats();
    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
