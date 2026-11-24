import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function checkIFG81IDetail() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    console.log('=== FACTURAS IFG81I (2026-10-15 a 2026-11-15) ===');
    const invoices = await db.collection('invoices').find({
        deviceIdName: 'IFG81I',
        date: { $gte: new Date('2026-10-15T00:00:00.000Z'), $lte: new Date('2026-11-20T00:00:00.000Z') }
    }).sort({ date: 1 }).toArray();

    invoices.forEach(inv => {
        console.log(`Inv: ${inv._id} | Date: ${inv.date?.toISOString()?.slice(0, 10)} | Amount: ${inv.amount} | PaidAmount: ${inv.paidAmount} | Paid: ${inv.paid} | DayType: ${inv.dayType} | CutOff: ${inv.cutOff} | contractId: ${inv.contractId} | TxRef: ${inv.transaction?.reference} | TxFinalized: ${inv.transaction?.finalized_at?.toISOString()}`);
    });

    console.log('\n=== PAGOS APROBADOS DE IFG81I ===');
    const payments = await db.collection('payments').find({
        $or: [
            { deviceIdName: 'IFG81I' },
            { plate: 'IFG81I' },
            { reference: { $regex: '^IFG81I' } }
        ],
        status: { $in: ['APPROVED', 'S_APPROVED'] },
        $or: [
            { created_at: { $gte: new Date('2026-10-15T00:00:00.000Z') } },
            { finalized_at: { $gte: new Date('2026-10-15T00:00:00.000Z') } }
        ]
    }).sort({ finalized_at: 1 }).toArray();

    payments.forEach(p => {
        console.log(`Pago: ${p._id} | Ref: ${p.reference} | Amount: ${p.amount} | Status: ${p.status} | UnpaidInv: ${p.unpaidInvoiceId} | InvId: ${p.invoiceId} | InvDate: ${p.invoiceDate?.toISOString()?.slice(0, 10)} | FinalizedAt: ${p.finalized_at?.toISOString()}`);
    });

    console.log('\n=== PAGOS PENDING / DECLINED DE IFG81I ===');
    const otherPayments = await db.collection('payments').find({
        $or: [
            { deviceIdName: 'IFG81I' },
            { plate: 'IFG81I' },
            { reference: { $regex: '^IFG81I' } }
        ],
        status: { $nin: ['APPROVED', 'S_APPROVED'] },
        $or: [
            { created_at: { $gte: new Date('2026-10-15T00:00:00.000Z') } },
            { finalized_at: { $gte: new Date('2026-10-15T00:00:00.000Z') } }
        ]
    }).sort({ created_at: 1 }).toArray();

    otherPayments.forEach(p => {
        console.log(`Pago [${p.status}]: ${p._id} | Ref: ${p.reference} | Amount: ${p.amount} | UnpaidInv: ${p.unpaidInvoiceId} | CreatedAt: ${p.created_at?.toISOString()}`);
    });

    await mongoose.disconnect();
}

checkIFG81IDetail().catch(console.error);

