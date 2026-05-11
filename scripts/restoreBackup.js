/**
 * restoreBackup.js
 * ----------------
 * Restores invoice documents from a JSON backup created by fixFreeInvoices.js.
 *
 * Usage:
 *   node scripts/restoreBackup.js dump/free_invoices_backup_2026-05-06T...json
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';
const backupFile = process.argv[2];

if (!backupFile) {
    console.error('❌ Usage: node scripts/restoreBackup.js <path-to-backup.json>');
    process.exit(1);
}

const resolvedPath = path.resolve(backupFile);

if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Backup file not found: ${resolvedPath}`);
    process.exit(1);
}

async function main() {
    const docs = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    console.log(`📂 Backup file: ${resolvedPath}`);
    console.log(`📋 Documents to restore: ${docs.length}\n`);

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected: ${MONGODB_URI}\n`);

    const collection = mongoose.connection.collection('invoices');

    let restored = 0;
    let skipped = 0;

    for (const doc of docs) {
        try {
            await collection.replaceOne(
                { _id: doc._id },
                doc,
                { upsert: true }
            );
            restored++;
        } catch (err) {
            console.error(`❌ Failed to restore ${doc._id}:`, err.message);
            skipped++;
        }
    }

    console.log(`✅ Restored: ${restored}`);
    if (skipped > 0) console.warn(`⚠️  Skipped/failed: ${skipped}`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected. Done.');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    mongoose.disconnect();
    process.exit(1);
});
