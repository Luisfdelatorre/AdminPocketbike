/**
 * fixFreeInvoices.js
 * ------------------
 * Corrects all invoices with dayType = 'FREE' that still have amount > 0.
 * Sets amount = 0 on every affected document.
 *
 * Flow:
 *   1. Connect & count affected documents
 *   2. Show sample
 *   3. 💾 Backup ALL affected docs to dump/ (always, before anything)
 *   4. ❓ Ask for confirmation — type 'y' to apply, anything else to abort
 *   5. Apply updateMany
 *   6. Verify
 *
 * Run from project root:
 *   node scripts/fixFreeInvoices.js
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';
const DUMP_DIR = path.resolve(__dirname, '../dump');

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected: ${MONGODB_URI}\n`);

    const collection = mongoose.connection.collection('invoices');

    // ── 1. Count affected documents ──────────────────────────────────────────
    const affected = await collection.countDocuments({
        dayType: 'FREE',
        amount: { $gt: 0 },
    });

    console.log(`🔍 Invoices with dayType=FREE and amount > 0: ${affected}`);

    if (affected === 0) {
        console.log('✅ Nothing to fix. Database is already clean.');
        await mongoose.disconnect();
        return;
    }

    // ── 2. Show sample ───────────────────────────────────────────────────────
    const sample = await collection
        .find({ dayType: 'FREE', amount: { $gt: 0 } })
        .limit(5)
        .toArray();

    console.log('\n📋 Sample of affected invoices (up to 5):');
    sample.forEach(inv =>
        console.log(`   _id: ${inv._id}  |  device: ${inv.deviceIdName}  |  date: ${inv.date?.toISOString?.().split('T')[0] ?? inv.date}  |  amount: ${inv.amount}`)
    );

    // ── 3. Backup ALWAYS (before any write) ──────────────────────────────────
    console.log('\n💾 Creating backup...');
    const allAffected = await collection
        .find({ dayType: 'FREE', amount: { $gt: 0 } })
        .toArray();

    if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(DUMP_DIR, `free_invoices_backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(allAffected, null, 2), 'utf8');
    console.log(`✅ Backup saved → ${backupFile}`);
    console.log(`   ${allAffected.length} documents backed up.\n`);

    // ── 4. Confirm before applying ───────────────────────────────────────────
    const answer = await ask(`❓ Apply fix to ${affected} invoices? (y/N): `);

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('\n⛔ Aborted. No changes were made.');
        console.log(`   Backup is still available at:\n   ${backupFile}`);
        await mongoose.disconnect();
        return;
    }

    // ── 5. Apply fix ─────────────────────────────────────────────────────────
    console.log('\n🔧 Applying fix...');
    const result = await collection.updateMany(
        { dayType: 'FREE', amount: { $gt: 0 } },
        { $set: { amount: 0, paidAmount: 0 } }
    );

    console.log(`✅ Fixed ${result.modifiedCount} of ${affected} invoices.`);

    // ── 6. Verify ────────────────────────────────────────────────────────────
    const remaining = await collection.countDocuments({
        dayType: 'FREE',
        amount: { $gt: 0 },
    });

    if (remaining === 0) {
        console.log('🎉 All FREE invoices now have amount = 0.');
    } else {
        console.warn(`⚠️  ${remaining} invoices still have amount > 0. Check manually.`);
    }

    console.log(`\n📂 To restore: node scripts/restoreBackup.js "${backupFile}"`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected. Done.');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    mongoose.disconnect();
    process.exit(1);
});
