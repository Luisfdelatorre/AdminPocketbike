import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import { Invoice } from '../server/models/Invoice.js';

async function seedFlags() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDatabase();

        // 1. Find a device with invoices (e.g., XZQ78H or similar from previous logs)
        // I'll just pick the first invoice found
        const invoices = await Invoice.find().limit(5);

        if (invoices.length < 2) {
            console.log('❌ Not enough invoices to test flags');
            return;
        }

        const inv1 = invoices[0];
        const inv2 = invoices[1];

        console.log(`🔹 Setting cutOff=true for invoice ${inv1._id} (${inv1.date})`);
        inv1.cutOff = true;
        await inv1.save();

        console.log(`🔹 Setting dayType='LOAN' for invoice ${inv2._id} (${inv2.date})`);
        inv2.dayType = 'LOAN';
        await inv2.save();

        console.log('✅ Flags seeded successfully!');

    } catch (error) {
        console.error('❌ Error seeding flags:', error);
    } finally {
        await disconnectDatabase();
    }
}

seedFlags();
