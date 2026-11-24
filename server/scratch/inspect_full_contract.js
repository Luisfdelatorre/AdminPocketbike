import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import { Contract } from '../models/Contract.js';

async function main() {
    await mongoose.connect(MongoDB.URI);
    const contract = await Contract.findOne({ contractId: 'CIPMQ44ITV' }).lean();
    console.log(JSON.stringify(contract, null, 2));
    await mongoose.disconnect();
}

main();
