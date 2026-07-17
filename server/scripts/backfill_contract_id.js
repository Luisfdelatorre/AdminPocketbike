/**
 * Migration Script: Backfill contractId on existing Invoices
 *
 * Problem: Before the contractId denormalization, invoices were only linked to
 * devices via deviceIdName. Now each invoice stores contractId directly.
 * Invoices created before this migration have contractId = null.
 *
 * Strategy:
 * For each contract (sorted by startDate ASC), find all invoices for that
 * device whose date falls within [contract.startDate, contract.endDate].
 * Update them with the contract's contractId.
 *
 * Run with:
 *   node server/scripts/backfill_contract_id.js
 *
 * Safe to run multiple times (idempotent — only updates docs where contractId is null).
 */

import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Contract } from '../models/Contract.js';
import { Invoice } from '../models/index.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB:', MONGO_URI);

    // Load all contracts ordered by deviceIdName, then startDate ascending
    const contracts = await Contract.find({}).sort({ deviceIdName: 1, startDate: 1 }).lean();
    console.log(`📋 Found ${contracts.length} contracts to process.\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const contract of contracts) {
        const { contractId, deviceIdName, startDate, endDate } = contract;

        const start = dayjs(startDate).startOf('day').toDate();
        // endDate may be in the future for ACTIVE contracts — cap at far future
        const end = endDate
            ? dayjs(endDate).endOf('day').toDate()
            : dayjs().add(10, 'year').toDate();

        const result = await Invoice.updateMany(
            {
                deviceIdName,
                date: { $gte: start, $lte: end },
                contractId: { $in: [null, undefined, ''] }  // only invoices missing contractId
            },
            { $set: { contractId } }
        );

        if (result.modifiedCount > 0) {
            console.log(`  ✅ [${contractId}] ${deviceIdName}: updated ${result.modifiedCount} invoices (${startDate} -> ${endDate || 'open'})`);
            totalUpdated += result.modifiedCount;
        } else {
            console.log(`  -- [${contractId}] ${deviceIdName}: no invoices to update`);
            totalSkipped++;
        }
    }

    console.log(`\n🏁 Done. Updated: ${totalUpdated} invoices. Contracts with nothing to do: ${totalSkipped}.`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
