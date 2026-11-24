import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import { Invoice } from '../models/Invoice.js';

async function main() {
    await mongoose.connect(MongoDB.URI);

    const used = await Invoice.countFreeDaysUsedThisMonth('PMQ44I');
    console.log('Free days count by Invoice.countFreeDaysUsedThisMonth:', used);

    const status = await invoiceRepository.getFreeDaysStatus('PMQ44I', 4);
    console.log('Free days status by invoiceRepository.getFreeDaysStatus:', status);

    const freeInvoicesNov = await Invoice.find({
        deviceIdName: 'PMQ44I',
        $or: [
            { dayType: 'FREE' },
            { 'transaction.type': 'FREE' },
            { amount: 0, paid: true }
        ],
        date: {
            $gte: new Date('2026-11-01T00:00:00.000Z'),
            $lte: new Date('2026-11-30T23:59:59.999Z')
        }
    }).lean();

    console.log('\n--- FACTURAS GRATIS O FREE EN NOVIEMBRE 2026 (Total: ' + freeInvoicesNov.length + ') ---');
    freeInvoicesNov.forEach(f => {
        console.log(`Fecha: ${f.date?.toISOString()?.slice(0, 10)} | ID: ${f._id} | dayType: ${f.dayType} | amount: ${f.amount} | txType: ${f.transaction?.type} | txRef: ${f.transaction?.reference}`);
    });

    await mongoose.disconnect();
}

main();
