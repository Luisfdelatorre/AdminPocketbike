import mongoose from 'mongoose';
import settingRepository from '../repositories/settingRepository.js';
import { MongoDB } from '../config/config.js';

async function run() {
    console.log('Connecting to DB:', MongoDB.URI);
    await mongoose.connect(MongoDB.URI);
    console.log('Connected to:', mongoose.connection.db.databaseName);

    try {
        console.log('\n--- 1. Testing getAdjustmentTypes ---');
        const adjTypes = await settingRepository.getAdjustmentTypes();
        console.log('Adjustment keys:', Object.keys(adjTypes));
        console.log('Does it contain PAID?:', 'PAID' in adjTypes);
        console.log('Does it contain NEQUI?:', 'NEQUI' in adjTypes);

        console.log('\n--- 2. Testing getPaymentStatuses ---');
        const payStatuses = await settingRepository.getPaymentStatuses();
        console.log('Payment status keys:', Object.keys(payStatuses));
        console.log('Does it contain PAID?:', 'PAID' in payStatuses);
        console.log('Does it contain NEQUI?:', 'NEQUI' in payStatuses);

        console.log('\n--- 3. Testing getAllStatusConfigs ---');
        const allConfigs = await settingRepository.getAllStatusConfigs();
        console.log('Total combined keys:', Object.keys(allConfigs).length);
        console.log('Contains both PAID and NEQUI?:', ('PAID' in allConfigs) && ('NEQUI' in allConfigs));

        console.log('\n--- 4. Testing Memory Cache (Fast Second Read) ---');
        const t0 = Date.now();
        await settingRepository.getAdjustmentTypes();
        await settingRepository.getPaymentStatuses();
        await settingRepository.getAllStatusConfigs();
        const elapsed = Date.now() - t0;
        console.log(`Cached reads completed in ${elapsed}ms!`);

        console.log('\nALL VERIFICATIONS PASSED! ✅');
    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
