import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Contract } from '../server/models/Contract.js';
import { Device } from '../server/models/Device.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkContractsGpsId() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully.\n');

        const contracts = await Contract.find({ status: 'ACTIVE' });
        console.log(`Found ${contracts.length} active contracts.`);

        let missingGpsIdCount = 0;
        let updatedCount = 0;
        let unresolvableCount = 0;

        for (const contract of contracts) {
            if (!contract.gpsId) {
                missingGpsIdCount++;
                console.log(`Contract ${contract.contractId} (Device: ${contract.deviceIdName}) is missing gpsId.`);

                // Attempt to find the associated device to get its gpsId
                const device = await Device.findOne({
                    $or: [
                        { name: contract.deviceIdName },
                        { _id: contract.deviceId }
                    ]
                });

                if (device && device.gpsId) {
                    // contract.gpsId = device.gpsId;
                    // await contract.save();
                    updatedCount++;
                    console.log(`  -> Successfully updated contract ${contract.contractId} with gpsId ${device.gpsId}`);
                } else {
                    unresolvableCount++;
                    console.log(`  -> Warning: Could not find matching device or device has no gpsId for contract ${contract.contractId}`);
                }
            }
        }

        console.log('\n=============================');
        console.log('Report:');
        console.log(`Total Active Contracts: ${contracts.length}`);
        console.log(`Contracts initially missing gpsId: ${missingGpsIdCount}`);
        console.log(`Contracts successfully updated: ${updatedCount}`);
        console.log(`Contracts still missing gpsId (unresolvable): ${unresolvableCount}`);
        console.log('=============================');

    } catch (error) {
        console.error('Error executing script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Database disconnected.');
    }
}

checkContractsGpsId();
