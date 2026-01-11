import { connectDatabase, disconnectDatabase } from './connection.js';
import { Device } from '../models/index.js';

async function initializeDatabase() {
    try {
        await connectDatabase();

        console.log('✅ Database initialized successfully');

        // Create sample devices for testing
        const sampleDevices = [
            { deviceId: 'BIKE001', deviceName: 'Pocketbike #001', deviceType: 'pocketbike' },
            { deviceId: 'BIKE002', deviceName: 'Pocketbike #002', deviceType: 'pocketbike' },
        ];

        for (const device of sampleDevices) {
            await Device.findOneAndUpdate(
                { deviceId: device.deviceId },
                device,
                { upsert: true, new: true }
            );
        }

        console.log('✅ Sample devices created/updated');

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    initializeDatabase()
        .then(() => {
            console.log('✅ Initialization complete');
            return disconnectDatabase();
        })
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Initialization failed:', error);
            process.exit(1);
        });
}

export default initializeDatabase;
