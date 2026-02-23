import mongoose from 'mongoose';
import { MongoDB } from '../server/config/components/core.js';
import invoiceRepository from '../server/repositories/invoiceRepository.js';
import contractRepository from '../server/repositories/contractRepository.js';

/**
 * Utility script to generate sample invoices for testing
 * Gets the daily rate from actual contracts
 */
async function generateSampleInvoices() {
    try {
        await mongoose.connect(MongoDB.URI, { dbName: 'payments-wompi' });

        // Get all active contracts
        const allContracts = await contractRepository.getAllContracts();
        const activeContracts = allContracts.filter(c => c.status === 'ACTIVE');

        if (activeContracts.length === 0) {
            console.log('⚠️  No active contracts found. Please create contracts first.');
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log(`📋 Found ${activeContracts.length} active contracts\n`);

        const today = new Date();
        const invoices = [];

        // Generate invoices for last 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD

            for (const contract of activeContracts) {
                // Use the actual daily rate from the contract
                const amount = contract.dailyRate; // Already in cents
                const deviceId = contract.deviceId;
                const contractId = contract.contractId;
                const deviceIdName = contract.deviceIdName;

                try {
                    const invoice = await invoiceRepository.createInvoice({
                        contractId,
                        deviceIdName,
                        deviceId,
                        date: dateStr,
                        amount,
                    });

                    invoices.push(invoice);
                    console.log(`✅ Created invoice: ${invoice.invoiceId}`);
                    console.log(`   Contract: ${contractId}`);
                    console.log(`   Device: ${deviceId}, Date: ${dateStr}, Amount: ${(amount / 100).toLocaleString()} COP\n`);
                } catch (error) {
                    if (error.code === 11000) {
                        console.log(`⏭️  Invoice already exists for ${deviceId} on ${dateStr}\n`);
                    } else {
                        throw error;
                    }
                }
            }
        }

        console.log(`✅ Generated ${invoices.length} sample invoices`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error generating invoices:', error);
        process.exit(1);
    }
}

generateSampleInvoices();
