import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Payment } from '../server/models/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspectPayments = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const payments = await Payment.find().sort({ createdAt: -1 }).limit(5).lean();
        console.log(JSON.stringify(payments, null, 2));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

inspectPayments();
