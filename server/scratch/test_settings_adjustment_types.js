import mongoose from 'mongoose';
import settingRepository from '../repositories/settingRepository.js';
import * as config from '../config/config.js';

async function runTest() {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/pocketbike?authSource=admin');
    console.log('Database connected!');

    try {
        console.log('\n--- 1. Getting Adjustment Types ---');
        const initialTypes = await settingRepository.getAdjustmentTypes();
        console.log('Keys returned:', Object.keys(initialTypes));
        console.log('ACCIDENT_TRANSIT details:', initialTypes.ACCIDENT_TRANSIT);

        console.log('\n--- 2. Updating Adjustment Types ---');
        const updatedTypes = {
            ...initialTypes,
            TEST_NEW_TYPE: {
                label: 'Ajuste - Pruebas ($0)',
                badgeLabel: 'PRUEBAS',
                color: '#8b5cf6',
                bg: '#f3e8ff',
                description: 'Ajuste de prueba del sistema',
                autoAmount: 0,
                autoReference: 'PRUEBA - Ajuste de sistema',
                isRealPayment: false,
                isFree: true
            }
        };

        const result = await settingRepository.updateAdjustmentTypes(updatedTypes);
        console.log('Updated Keys count:', Object.keys(result).length);
        console.log('TEST_NEW_TYPE label:', result.TEST_NEW_TYPE?.label);

        console.log('\n--- 3. Verifying retrieval after update ---');
        const verified = await settingRepository.getAdjustmentTypes();
        console.log('Verified TEST_NEW_TYPE present:', !!verified.TEST_NEW_TYPE);

        // Cleanup test key
        delete updatedTypes.TEST_NEW_TYPE;
        await settingRepository.updateAdjustmentTypes(updatedTypes);
        console.log('Cleaned up test key successfully!');

        console.log('\nALL TESTS PASSED SUCCESSFULLY! ✅');
    } catch (err) {
        console.error('Test error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
