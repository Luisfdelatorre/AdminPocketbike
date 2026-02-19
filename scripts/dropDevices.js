
import mongoose from 'mongoose';
import { MongoDB } from '../server/config/components/core.js';

const dropDevices = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MongoDB.URI);
        console.log('✅ Connected.');

        const collections = await mongoose.connection.db.listCollections({ name: 'devices' }).toArray();

        if (collections.length > 0) {
            console.log('🗑️ Dropping collection "devices"...');
            await mongoose.connection.db.dropCollection('devices');
            console.log('✅ Collection "devices" dropped successfully.');
        } else {
            console.log('⚠️ Collection "devices" does not exist.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected.');
        process.exit();
    }
};

dropDevices();
