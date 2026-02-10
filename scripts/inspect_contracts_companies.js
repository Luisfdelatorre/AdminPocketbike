import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Company } from '../server/models/Company.js';
import { Contract } from '../server/models/Contract.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        console.log('\n--- Companies ---');
        const companies = await Company.find({});
        companies.forEach(c => console.log(`ID: ${c._id}, Name: ${c.name}`));

        console.log('\n--- Contracts (First 5) ---');
        const contracts = await Contract.find({}).limit(5);
        contracts.forEach(c => console.log(`ID: ${c._id}, Device: ${c.deviceIdName}, CompanyId: ${c.companyId}, CompanyName: ${c.companyName}`));

        const contractWithCompany = await Contract.findOne({ companyId: { $exists: true } });
        if (contractWithCompany) {
            console.log(`\nSample Contract with Company: CompanyId type: ${typeof contractWithCompany.companyId}, Value: ${contractWithCompany.companyId}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

inspect();
