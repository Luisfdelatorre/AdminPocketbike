
import mongoose from 'mongoose';
import { Device } from '../server/models/Device.js';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Update all devices that don't have a cutOff field (or just all of them to be safe)
        const result = await Device.updateMany(
            { cutOff: { $exists: false } },
            { $set: { cutOff: 0 } }
        );

        console.log(`Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

        // Also verify those that have null/undefined if any
        const result2 = await Device.updateMany(
            { cutOff: null },
            { $set: { cutOff: 0 } }
        );
        console.log(`Cleanup nulls complete. Matched: ${result2.matchedCount}, Modified: ${result2.modifiedCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrate();
