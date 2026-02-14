/**
 * Seed script to populate leaderboard with mock data
 * Run with: node scripts/seed-leaderboard.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', 'base64').toString('utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

// Mock avatars (using UI Avatars API)
const getAvatar = (name) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
};

// Generate random UID
const generateUID = () => {
  return 'mock_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Generate scores for different modes
const generateScores = () => {
  const scores = [];
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  USERNAMES.forEach((username, index) => {
    const uid = generateUID();
    const photoURL = getAvatar(username);

    // 6.7s mode scores (15-85 reps range)
    const score67s = Math.floor(Math.random() * 70) + 15;
    const created67s = new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString();
    scores.push({
      username,
      uid,
      photoURL,
      score: score67s,
      duration_ms: 6700,
      created_at: created67s,
    });

    // 20s mode scores (40-250 reps range)
    const score20s = Math.floor(Math.random() * 210) + 40;
    const created20s = new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString();
    scores.push({
      username,
      uid,
      photoURL,
      score: score20s,
      duration_ms: 20000,
      created_at: created20s,
    });

    // 67 reps mode scores (time in ms: 5000-30000 range)
    const score67reps = Math.floor(Math.random() * 25000) + 5000;
    const created67reps = new Date(oneDayAgo + Math.random() * (now - oneDayAgo)).toISOString();
    scores.push({
      username,
      uid,
      photoURL,
      score: score67reps,
      duration_ms: -1, // 67 reps mode marker
      created_at: created67reps,
    });
  });

  return scores;
};

// Generate PvP stats
const generatePvPStats = () => {
  const stats = [];

  USERNAMES.forEach((username, index) => {
    const uid = generateUID();
    const photoURL = getAvatar(username);

    // Generate W/L record
    const totalGames = Math.floor(Math.random() * 50) + 10;
    const wins = Math.floor(Math.random() * totalGames);
    const losses = totalGames - wins;

    // Calculate trophies based on W/L (start at 100, +30 per win, -15 per loss)
    const trophies = Math.max(0, 100 + (wins * 30) - (losses * 15));

    stats.push({
      uid,
      username,
      photoURL,
      trophies,
      wins,
      losses,
    });
  });

  return stats;
};

async function seedData() {
  console.log('🌱 Starting leaderboard seed...\n');

  try {
    // Generate data
    const scores = generateScores();
    const pvpStats = generatePvPStats();

    console.log(`📊 Generated ${scores.length} scores`);
    console.log(`🏆 Generated ${pvpStats.length} PvP stats\n`);

    // Seed scores
    console.log('💾 Writing scores to Firestore...');
    const batch = db.batch();
    let count = 0;

    for (const score of scores) {
      const ref = db.collection('scores').doc();
      batch.set(ref, score);
      count++;

      // Firestore batch limit is 500, commit and create new batch if needed
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`   ✓ Committed ${count} scores`);
      }
    }

    await batch.commit();
    console.log(`   ✓ Committed all ${scores.length} scores\n`);

    // Seed PvP stats
    console.log('🎮 Writing PvP stats to Firestore...');
    const statsBatch = db.batch();

    for (const stat of pvpStats) {
      const ref = db.collection('user_stats').doc(stat.uid);
      statsBatch.set(ref, {
        trophies: stat.trophies,
        wins: stat.wins,
        losses: stat.losses,
        username: stat.username,
        photoURL: stat.photoURL,
      });
    }

    await statsBatch.commit();
    console.log(`   ✓ Committed ${pvpStats.length} PvP stats\n`);

    console.log('✅ Seed completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   • ${scores.length} total scores added`);
    console.log(`   • ${scores.length / 3} players per mode`);
    console.log(`   • ${pvpStats.length} PvP player stats`);
    console.log(`   • Modes: 6.7s, 20s, 67 reps`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
