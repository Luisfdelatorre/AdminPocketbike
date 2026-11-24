import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function checkIFG81IOnly() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    console.log('=== FACTURAS IFG81I (desde 2026-11-01) ===');
    const invoices = await db.collection('invoices').find({
        deviceIdName: 'IFG81I',
        date: { $gte: new Date('2026-11-01T00:00:00.000Z') }
    }).sort({ date: 1 }).toArray();

    invoices.forEach(inv => {
        console.log(`Inv: ${inv._id} | Date: ${inv.date?.toISOString()?.slice(0, 10)} | Amount: ${inv.amount} | PaidAmount: ${inv.paidAmount} | Paid: ${inv.paid} | DayType: ${inv.dayType} | CutOff: ${inv.cutOff} | contractId: ${inv.contractId} | TxRef: ${inv.transaction?.reference} | TxFinalized: ${inv.transaction?.finalized_at?.toISOString()}`);
    });

    console.log('\n=== TODOS LOS PAGOS DE IFG81I (desde 2026-11-01) ===');
    const payments = await db.collection('payments').find({
        deviceIdName: 'IFG81I',
        $or: [
            { created_at: { $gte: new Date('2026-11-01T00:00:00.000Z') } },
            { finalized_at: { $gte: new Date('2026-11-01T00:00:00.000Z') } },
            { createdAt: { $gte: new Date('2026-11-01T00:00:00.000Z') } }
        ]
    }).sort({ created_at: 1, createdAt: 1 }).toArray();

    payments.forEach(p => {
        console.log(`Pago [${p.status}]: ${p._id} | Ref: ${p.reference} | Amount: ${p.amount} | UnpaidInv: ${p.unpaidInvoiceId} | InvId: ${p.invoiceId} | InvDate: ${p.invoiceDate?.toISOString()?.slice(0, 10)} | FinalizedAt: ${p.finalized_at?.toISOString()} | CreatedAt: ${(p.created_at || p.createdAt)?.toISOString()}`);
    });

    console.log('\n=== FACTURAS IMPAGAS TOTALES DE IFG81I ===');
    const unpaid = await db.collection('invoices').find({
        deviceIdName: 'IFG81I',
        paid: false
    }).sort({ date: 1 }).toArray();
    console.log(`Total facturas impagas: ${unpaid.length}`);
    unpaid.forEach(u => {
        console.log(`  -> Impaga: ${u._id} | Date: ${u.date?.toISOString()?.slice(0, 10)} | Amount: ${u.amount} | dayType: ${u.dayType} | cutOff: ${u.cutOff}`);
    });

    await mongoose.disconnect();
}

checkIFG81IOnly().catch(console.error);

