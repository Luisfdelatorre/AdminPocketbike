import { connectDatabase } from '../server/database/connection.js';
import contractRepository from '../server/repositories/contractRepository.js';

async function createSampleContracts() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDatabase();

        const devices = ['BIKE001', 'BIKE002'];
        const today = new Date().toISOString().split('T')[0];

        for (const deviceId of devices) {
            // Check if contract already exists
            const existing = await contractRepository.getActiveContractByDevice(deviceId);

            if (existing) {
                console.log(`⏭️  Contract already exists for ${deviceId}: ${existing.contractId}`);
                continue;
            }

            // Create contract
            const contract = await contractRepository.createContract({
                deviceId,
                dailyRate: 3000000, // 30,000 COP in cents
                contractDays: 500,
                startDate: today,
                customerName: `Customer for ${deviceId}`,
                customerEmail: `customer.${deviceId.toLowerCase()}@example.com`,
                customerPhone: '+57 300 123 4567',
                customerDocument: '1234567890',
                notes: `500-day rental contract for ${deviceId}`,
            });

            console.log(`✅ Created contract: ${contract.contractId}`);
            console.log(`   Device: ${contract.deviceId}`);
            console.log(`   Daily Rate: ${contract.dailyRate / 100} COP`);
            console.log(`   Total Days: ${contract.contractDays}`);
            console.log(`   Total Amount: ${contract.totalAmount / 100} COP`);
            console.log(`   Start Date: ${contract.startDate}`);
            console.log(`   End Date: ${contract.endDate}`);
            console.log('');
        }

        console.log('✅ Sample contracts created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating contracts:', error);
        process.exit(1);
    }
}

createSampleContracts();
