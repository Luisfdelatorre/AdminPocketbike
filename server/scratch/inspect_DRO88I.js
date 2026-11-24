import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function inspectDRO88I() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    console.log('=== DISPOSITIVO DRO88I ===');
    const device = await db.collection('devices').findOne({ name: 'DRO88I' });
    console.log(JSON.stringify(device, null, 2));

    console.log('\n=== CONTRATO(S) DRO88I ===');
    const contracts = await db.collection('contracts').find({ deviceIdName: 'DRO88I' }).toArray();
    console.log(JSON.stringify(contracts, null, 2));

    console.log('\n=== FACTURAS DRO88I (todas) ===');
    const invoices = await db.collection('invoices').find({ deviceIdName: 'DRO88I' }).sort({ date: 1 }).toArray();
    console.log(`Total facturas: ${invoices.length}`);
    invoices.forEach(inv => {
        console.log({
            _id: inv._id,
            date: inv.date?.toISOString()?.slice(0, 10),
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            paid: inv.paid,
            dayType: inv.dayType,
            cutOff: inv.cutOff,
            adjustmentType: inv.adjustmentType,
            txRef: inv.transaction?.reference,
            txFinalizedAt: inv.transaction?.finalized_at,
            createdAt: inv.createdAt
        });
    });

    console.log('\n=== PAGOS DRO88I (todos) ===');
    const payments = await db.collection('payments').find({
        $or: [
            { deviceIdName: 'DRO88I' },
            { plate: 'DRO88I' },
            { reference: { $regex: '^DRO88I' } }
        ]
    }).sort({ created_at: 1, createdAt: 1 }).toArray();
    console.log(`Total pagos: ${payments.length}`);
    payments.forEach(p => {
        console.log({
            _id: p._id,
            reference: p.reference,
            amount: p.amount,
            status: p.status,
            type: p.type,
            payment_method_type: p.payment_method_type,
            invoiceId: p.invoiceId,
            unpaidInvoiceId: p.unpaidInvoiceId,
            invoiceDate: p.invoiceDate?.toISOString()?.slice(0, 10),
            finalized_at: p.finalized_at,
            created_at: p.created_at || p.createdAt,
            used: p.used
        });
    });

    await mongoose.disconnect();
}

inspectDRO88I().catch(console.error);

