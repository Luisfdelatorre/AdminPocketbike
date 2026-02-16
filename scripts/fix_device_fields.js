
import mongoose from 'mongoose';
import { connectDatabase } from '../server/database/connection.js';
import { Device } from '../server/models/Device.js';

const fixDevices = async () => {
    try {
        await connectDatabase();
        console.log('✅ Connected to MongoDB');

        const result = await Device.updateMany(
            {},
            [
                {
                    $set: {
                        isDeleted: { $ifNull: ["$isDeleted", false] },
                        disabled: { $ifNull: ["$disabled", false] },
                        isActive: { $ifNull: ["$isActive", true] },
                        dailyRate: { $ifNull: ["$dailyRate", 0] },
                        hasActiveContract: { $ifNull: ["$hasActiveContract", false] }
                    }
                }
            ]
        );

        console.log(`✅ Updated ${result.modifiedCount} devices with default values.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing devices:', error);
        process.exit(1);
    }
};

fixDevices();
