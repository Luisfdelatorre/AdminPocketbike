import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function inspectIFG81I() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    console.log('=== DISPOSITIVO IFG81I ===');
    const device = await db.collection('devices').findOne({ name: 'IFG81I' });
    console.log({
        name: device?.name,
        cutOff: device?.cutOff,
        activeContractId: device?.activeContractId,
        dailyRate: device?.dailyRate,
        companyName: device?.companyName
    });

    console.log('\n=== CONTRATO(S) IFG81I ===');
    const contracts = await db.collection('contracts').find({ deviceIdName: 'IFG81I' }).toArray();
    contracts.forEach(c => {
        console.log({
            contractId: c.contractId,
            status: c.status,
            startDate: c.startDate,
            endDate: c.endDate,
            dailyRate: c.dailyRate,
            paidDays: c.paidDays,
            remainingDays: c.remainingDays,
            paidAmount: c.paidAmount,
            schemaVersion: c.schemaVersion,
            paymentFrequency: c.paymentFrequency,
            freeDayPolicy: c.freeDayPolicy
        });
    });

    console.log('\n=== FACTURAS RECIENTES IFG81I (desde 2026-10-01) ===');
    const invoices = await db.collection('invoices').find({
        deviceIdName: 'IFG81I',
        date: { $gte: new Date('2026-10-01T00:00:00.000Z') }
    }).sort({ date: 1 }).toArray();

    invoices.forEach(inv => {
        console.log(`Inv: ${inv._id} | Date: ${inv.date?.toISOString()?.slice(0, 10)} | Amount: ${inv.amount} | PaidAmount: ${inv.paidAmount} | Paid: ${inv.paid} | DayType: ${inv.dayType} | CutOff: ${inv.cutOff} | contractId: ${inv.contractId} | TxRef: ${inv.transaction?.reference} | TxFinalized: ${inv.transaction?.finalized_at?.toISOString()}`);
    });

    console.log('\n=== PAGOS RECIENTES IFG81I (desde 2026-10-01) ===');
    const payments = await db.collection('payments').find({
        $or: [
            { deviceIdName: 'IFG81I' },
            { plate: 'IFG81I' },
            { reference: { $regex: '^IFG81I' } }
        ],
        $or: [
            { created_at: { $gte: new Date('2026-10-01T00:00:00.000Z') } },
            { finalized_at: { $gte: new Date('2026-10-01T00:00:00.000Z') } }
        ]
    }).sort({ finalized_at: 1, created_at: 1 }).toArray();

    payments.forEach(p => {
        console.log(`Pago: ${p._id} | Ref: ${p.reference} | Amount: ${p.amount} | Status: ${p.status} | Type: ${p.type} | UnpaidInvId: ${p.unpaidInvoiceId} | InvId: ${p.invoiceId} | InvDate: ${p.invoiceDate?.toISOString()?.slice(0, 10)} | FinalizedAt: ${p.finalized_at?.toISOString()}`);
    });

    await mongoose.disconnect();
}

inspectIFG81I().catch(console.error);

