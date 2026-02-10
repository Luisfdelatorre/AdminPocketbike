
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Contract } from '../server/models/Contract.js';
import { Device } from '../server/models/Device.js';
import { Company } from '../server/models/Company.js'; // Ensure model is registered

dotenv.config();

const migrateContracts = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const contracts = await Contract.find({});
        console.log(`Found ${contracts.length} contracts to check.`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const contract of contracts) {
            if (contract.companyId) {
                skippedCount++;
                continue;
            }

            // Find device associated with contract
            // Try matching by deviceId (which might be _id) or deviceIdName
            let device = await Device.findOne({ _id: contract.deviceId });

            if (!device && contract.deviceIdName) {
                device = await Device.findOne({ name: contract.deviceIdName });
            }

            if (device && device.companyId) {
                contract.companyId = device.companyId;
                contract.companyName = device.companyName;
                await contract.save();
                console.log(`Updated contract ${contract.contractId} with company ${device.companyName}`);
                updatedCount++;
            } else {
                console.error(`Could not find device or company for contract ${contract.contractId}`);
                errorCount++;
            }
        }

        console.log(`Migration complete.`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

migrateContracts();
