import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import { Invoice } from '../server/models/Invoice.js';
import { Contract } from '../server/models/Contract.js';

/**
 * Migration script to add contractId to existing invoices
 * Matches invoices to contracts based on deviceId and date range
 */
async function migrateInvoiceContractIds() {
    try {
        await connectDatabase();
        console.log('🔄 Starting migration: Add contractId to existing invoices\n');

        // Find all invoices without contractId
        const invoicesWithoutContract = await Invoice.find({
            $or: [
                { contractId: { $exists: false } },
                { contractId: null },
                { contractId: '' }
            ]
        }).sort({ date: 1 });

        console.log(`📊 Found ${invoicesWithoutContract.length} invoices without contractId\n`);

        if (invoicesWithoutContract.length === 0) {
            console.log('✅ All invoices already have contractId!');
            await disconnectDatabase();
            process.exit(0);
        }

        let updated = 0;
        let skipped = 0;
        const errors = [];

        // Process each invoice
        for (const invoice of invoicesWithoutContract) {
            try {
                // Find the contract that was active on this invoice date
                const contract = await Contract.findOne({
                    deviceId: invoice.deviceId,
                    startDate: { $lte: invoice.date },
                    endDate: { $gte: invoice.date },
                    status: { $in: ['ACTIVE', 'COMPLETED'] }
                }).sort({ createdAt: -1 }); // Get most recent if multiple

                if (contract) {
                    // Update invoice with contractId
                    await Invoice.updateOne(
                        { _id: invoice._id },
                        { $set: { contractId: contract.contractId } }
                    );

                    updated++;
                    console.log(`✅ ${invoice.invoiceId} → ${contract.contractId}`);
                } else {
                    skipped++;
                    console.log(`⚠️  ${invoice.invoiceId} - No matching contract found`);
                    console.log(`   Device: ${invoice.deviceId}, Date: ${invoice.date}`);
                    errors.push({
                        invoiceId: invoice.invoiceId,
                        deviceId: invoice.deviceId,
                        date: invoice.date,
                        reason: 'No matching contract'
                    });
                }
            } catch (err) {
                skipped++;
                console.error(`❌ Error processing ${invoice.invoiceId}:`, err.message);
                errors.push({
                    invoiceId: invoice.invoiceId,
                    error: err.message
                });
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Updated: ${updated} invoices`);
        console.log(`⚠️  Skipped: ${skipped} invoices`);
        console.log(`📊 Total: ${invoicesWithoutContract.length} invoices processed`);

        if (errors.length > 0) {
            console.log('\n❌ ERRORS/WARNINGS:');
            errors.forEach((err, idx) => {
                console.log(`\n${idx + 1}. Invoice: ${err.invoiceId}`);
                if (err.reason) {
                    console.log(`   Device: ${err.deviceId}, Date: ${err.date}`);
                    console.log(`   Reason: ${err.reason}`);
                }
                if (err.error) {
                    console.log(`   Error: ${err.error}`);
                }
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration completed!');
        console.log('='.repeat(60));

        await disconnectDatabase();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error('Stack trace:', error.stack);
        await disconnectDatabase();
        process.exit(1);
    }
}

// Run migration
console.log('\n' + '='.repeat(60));
console.log('🚀 INVOICE CONTRACT ID MIGRATION');
console.log('='.repeat(60));
console.log('This script will:');
console.log('1. Find all invoices without contractId');
console.log('2. Match them to contracts by device and date');
console.log('3. Update invoices with the correct contractId');
console.log('='.repeat(60) + '\n');

migrateInvoiceContractIds();
