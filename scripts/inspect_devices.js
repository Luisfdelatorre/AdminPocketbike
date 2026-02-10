import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Device } from '../server/models/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const total = await Device.countDocuments({});
        const withCompany = await Device.countDocuments({ companyId: { $exists: true, $ne: null } });
        const withoutCompany = await Device.countDocuments({ companyId: { $exists: false } });

        console.log(`Total Devices: ${total}`);
        console.log(`With CompanyId: ${withCompany}`);
        console.log(`Without CompanyId: ${withoutCompany}`);

        const sample = await Device.findOne({ companyId: { $exists: true } });
        if (sample) {
            console.log(`Sample with company: Name=${sample.name}, CompanyId=${sample.companyId}`);
        } else {
            console.log('No devices have companyId!');
        }

        // Check specific ones from migration failure
        const specific = await Device.findOne({ name: 'ZHJ46G' });
        console.log(`\nLookup 'ZHJ46G' by name:`, specific ? 'Found' : 'Not Found');

        const specific2 = await Device.findOne({ deviceName: 'ZHJ46G' });
        console.log(`Lookup 'ZHJ46G' by deviceName:`, specific2 ? 'Found' : 'Not Found');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

inspect();
