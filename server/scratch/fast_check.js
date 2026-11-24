import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    // Esta semana (del 9 de noviembre al 14 de noviembre de 2026)
    const startOfWeek = new Date('2026-11-09T00:00:00.000Z');

    // 1. Facturas pagadas (paid: true) creadas o de fecha reciente (noviembre 2026)
    // donde falta transaction.finalized_at o paymentDate
    const invoicesWithoutFinalized = await db.collection('invoices').find({
        paid: true,
        date: { $gte: startOfWeek },
        $or: [
            { 'transaction.finalized_at': null },
            { 'transaction.finalized_at': { $exists: false } },
            { paymentDate: null },
            { paymentDate: { $exists: false } }
        ]
    }).toArray();

    console.log('=== FACTURAS DE ESTA SEMANA PAGADAS PERO SIN finalized_at O paymentDate ===');
    console.log(`Total encontradas: ${invoicesWithoutFinalized.length}`);
    invoicesWithoutFinalized.forEach(inv => {
        console.log(`Placa: ${inv.deviceIdName} | Fecha Inv: ${inv.date?.toISOString()?.slice(0,10)} | Amount: ${inv.amount} | PaidAmount: ${inv.paidAmount} | paymentDate: ${inv.paymentDate} | txFinalizedAt: ${inv.transaction?.finalized_at} | txRef: ${inv.transaction?.reference}`);
    });

    // 2. Pagos aprobados de esta semana
    const paymentsThisWeek = await db.collection('payments').find({
        $or: [
            { created_at: { $gte: startOfWeek } },
            { finalized_at: { $gte: startOfWeek } },
            { createdAt: { $gte: startOfWeek } }
        ],
        status: { $in: ['APPROVED', 'S_APPROVED'] }
    }).project({ _id: 1, reference: 1, deviceIdName: 1, plate: 1, amount: 1, invoiceId: 1, unpaidInvoiceId: 1, finalized_at: 1, created_at: 1 }).toArray();

    console.log(`\n=== PAGOS APROBADOS DE ESTA SEMANA (Total: ${paymentsThisWeek.length}) ===`);
    // Pagos aprobados sin finalized_at
    const paymentsWithoutFinalized = paymentsThisWeek.filter(p => !p.finalized_at);
    console.log(`Pagos aprobados sin finalized_at: ${paymentsWithoutFinalized.length}`);
    paymentsWithoutFinalized.forEach(p => {
        console.log(`Pago ID: ${p._id} | Ref: ${p.reference} | Placa: ${p.deviceIdName || p.plate} | Created: ${p.created_at} | finalized_at: ${p.finalized_at}`);
    });

    // 3. Revisar si hay facturas asociadas a esos pagos donde la factura no tenga finalized_at
    const invIds = [...new Set(paymentsThisWeek.map(p => p.invoiceId || p.unpaidInvoiceId).filter(Boolean))];
    const invoices = await db.collection('invoices').find({ _id: { $in: invIds } }).toArray();
    const invMap = new Map(invoices.map(i => [String(i._id), i]));

    const discrepancies = [];
    for (const p of paymentsThisWeek) {
        const invId = p.invoiceId || p.unpaidInvoiceId;
        const inv = invMap.get(String(invId));
        if (inv) {
            const invTxFinalized = inv.transaction?.finalized_at;
            const invPaymentDate = inv.paymentDate;
            if (!invTxFinalized || !invPaymentDate || !p.finalized_at) {
                discrepancies.push({
                    plate: p.deviceIdName || p.plate || inv.deviceIdName,
                    paymentRef: p.reference,
                    pFinalizedAt: p.finalized_at,
                    invoiceId: inv._id,
                    invoiceDate: inv.date,
                    paid: inv.paid,
                    paidAmount: inv.paidAmount,
                    amount: inv.amount,
                    invPaymentDate,
                    invTxFinalized
                });
            }
        }
    }

    console.log(`\n=== DISCREPANCIAS ENTRE PAGO APROBADO E INVOICE (Total: ${discrepancies.length}) ===`);
    console.log(JSON.stringify(discrepancies, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);

