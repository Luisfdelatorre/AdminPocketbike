import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function inspectOctoberNovember() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const invoices = await db.collection('invoices').find({
        deviceIdName: 'DRO88I',
        date: { $gte: new Date('2026-10-01T00:00:00.000Z') }
    }).sort({ date: 1 }).toArray();

    console.log(`Facturas DRO88I desde Octubre: ${invoices.length}`);
    invoices.forEach(inv => {
        console.log(`Inv: ${inv._id} | Date: ${inv.date?.toISOString()?.slice(0, 10)} | Amount: ${inv.amount} | PaidAmount: ${inv.paidAmount} | Paid: ${inv.paid} | DayType: ${inv.dayType} | CutOff: ${inv.cutOff} | TxRef: ${inv.transaction?.reference} | TxFinalized: ${inv.transaction?.finalized_at?.toISOString()}`);
    });

    console.log('\n--- Pagos aprobados de DRO88I en noviembre 2026 ---');
    const novPayments = await db.collection('payments').find({
        $or: [{ deviceIdName: 'DRO88I' }, { plate: 'DRO88I' }, { reference: { $regex: '^DRO88I' } }],
        status: 'APPROVED',
        finalized_at: { $gte: new Date('2026-11-01T00:00:00.000Z') }
    }).sort({ finalized_at: 1 }).toArray();

    novPayments.forEach(p => {
        console.log(`Pago: ${p._id} | Ref: ${p.reference} | Amount: ${p.amount} | UnpaidInvId: ${p.unpaidInvoiceId} | InvDate: ${p.invoiceDate?.toISOString()?.slice(0, 10)} | FinalizedAt: ${p.finalized_at?.toISOString()}`);
    });

    await mongoose.disconnect();
}

inspectOctoberNovember().catch(console.error);

