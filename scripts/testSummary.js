import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import paymentRepository from '../server/repositories/paymentRepository.js';

async function testSummary() {
    try {
        await connectDatabase();

        console.log('Fetching monthly payment summary...');
        const summary = await paymentRepository.getMonthlyPaymentSummary({
            month: 2, // February
            year: 2026,
            companyId: null // Fetch for all companies or specify if needed
        });

        console.log('Summary Result (First 2 items):');
        console.log(JSON.stringify(summary.slice(0, 2), null, 2));

        // Check specific device if needed
        const targetDevice = summary.find(s => s.device.name === 'XZQ78H');
        if (targetDevice) {
            console.log('\nSpecific Device (XZQ78H):');
            console.log(JSON.stringify(targetDevice, null, 2));
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await disconnectDatabase();
    }
}

testSummary();
