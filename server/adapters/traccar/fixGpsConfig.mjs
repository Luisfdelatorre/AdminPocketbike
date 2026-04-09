/**
 * fixGpsConfig.mjs
 * Inspect (and optionally fix) the gpsConfig stored in the Company collection.
 *
 * Run:  node server/adapters/traccar/fixGpsConfig.mjs
 * To apply the fix add --fix flag:
 *        node server/adapters/traccar/fixGpsConfig.mjs --fix
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// ── adjust if your mongo URI is elsewhere ─────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/pocketbike';
const CORRECT_PASSWORD = 'Medalla6571*';
const FIX = process.argv.includes('--fix');

await mongoose.connect(MONGO_URI);
console.log('✅ MongoDB connected');

const companies = await mongoose.connection.db.collection('companies').find({}).toArray();

for (const c of companies) {
  const cfg = c.gpsConfig || {};
  console.log(`\nCompany: ${c.name}`);
  console.log(`  gpsService : ${c.gpsService}`);
  console.log(`  gpsConfig  : host=${cfg.host}  user=${cfg.user}  password=${cfg.password ?? '(empty)'}  len=${cfg.password?.length ?? 0}`);

  if (c.gpsService === 'traccar' && cfg.password !== CORRECT_PASSWORD) {
    console.log(`  ⚠️  Password mismatch! stored="${cfg.password}" expected="${CORRECT_PASSWORD}"`);

    if (FIX) {
      await mongoose.connection.db.collection('companies').updateOne(
        { _id: c._id },
        { $set: { 'gpsConfig.password': CORRECT_PASSWORD } }
      );
      console.log(`  ✅ Fixed!`);
    } else {
      console.log(`  ℹ️  Run with --fix to update.`);
    }
  } else {
    console.log(`  ✅ Password OK`);
  }
}

await mongoose.disconnect();
console.log('\nDone.');
