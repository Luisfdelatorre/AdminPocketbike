import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function checkContractIdOnInvoices() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const invoices = await db.collection('invoices').find({
        deviceIdName: 'DRO88I',
        date: { $gte: new Date('2026-10-15T00:00:00.000Z'), $lte: new Date('2026-11-20T00:00:00.000Z') }
    }).sort({ date: 1 }).toArray();

    console.log('Invoices contractId check:');
    invoices.forEach(inv => {
        console.log(`Inv: ${inv._id} | Date: ${inv.date?.toISOString()?.slice(0, 10)} | contractId: ${inv.contractId} | paid: ${inv.paid} | dayType: ${inv.dayType}`);
    });

    await mongoose.disconnect();
}

checkContractIdOnInvoices().catch(console.error);

