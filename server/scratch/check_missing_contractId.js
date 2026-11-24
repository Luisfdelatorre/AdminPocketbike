import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function checkMissingContractId() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const totalInvoices = await db.collection('invoices').countDocuments();
    const missingContractId = await db.collection('invoices').countDocuments({
        contractId: { $in: [null, undefined, ''] }
    });
    const withContractId = await db.collection('invoices').countDocuments({
        contractId: { $exists: true, $nin: [null, ''] }
    });

    console.log(`Total facturas: ${totalInvoices}`);
    console.log(`Facturas SIN contractId: ${missingContractId}`);
    console.log(`Facturas CON contractId: ${withContractId}`);

    await mongoose.disconnect();
}

checkMissingContractId().catch(console.error);

