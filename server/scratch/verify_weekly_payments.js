import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import dayjs from 'dayjs';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    // Esta semana: desde lunes 2026-11-09 00:00:00
    const startOfWeek = new Date('2026-11-09T00:00:00.000Z');
    const endOfWeek = new Date('2026-11-15T23:59:59.999Z');

    console.log('--- Buscando pagos de esta semana (>= 2026-11-09) ---');
    const recentPayments = await db.collection('payments').find({
        $or: [
            { created_at: { $gte: startOfWeek } },
            { finalized_at: { $gte: startOfWeek } },
            { createdAt: { $gte: startOfWeek } }
        ],
        status: { $in: ['APPROVED', 'S_APPROVED'] }
    }).toArray();

    console.log(`Total pagos aprobados esta semana: ${recentPayments.length}`);

    // Revisar invoices vinculadas a estos pagos
    const invoiceIssues = [];
    const contractIssues = [];

    for (const p of recentPayments) {
        const invId = p.invoiceId || p.unpaidInvoiceId;
        const deviceIdName = p.deviceIdName || p.plate;
        
        let invoice = null;
        if (invId) {
            invoice = await db.collection('invoices').findOne({
                $or: [{ _id: invId }, { invoiceId: invId }]
            });
        }
        if (!invoice && deviceIdName) {
            // Buscar por payment reference o transaction id
            invoice = await db.collection('invoices').findOne({
                $or: [
                    { 'transaction.id': p._id },
                    { 'transaction.reference': p.reference },
                    { 'transaction._id': p._id }
                ]
            });
        }

        const contract = await db.collection('contracts').findOne({
            deviceIdName: deviceIdName,
            status: 'ACTIVE'
        });

        // Revisar si en invoice falta finalized_at
        const invFinalizedAt = invoice?.transaction?.finalized_at || invoice?.paymentDate;
        const pFinalizedAt = p.finalized_at;

        invoiceIssues.push({
            paymentId: p._id,
            reference: p.reference,
            plate: deviceIdName,
            paymentAmount: p.amount,
            pFinalizedAt,
            pCreatedAt: p.created_at || p.createdAt,
            invoiceFound: !!invoice,
            invoiceId: invoice?._id || invoice?.invoiceId,
            invoicePaid: invoice?.paid,
            invoicePaidAmount: invoice?.paidAmount,
            invoiceAmount: invoice?.amount,
            invoiceDate: invoice?.date,
            invFinalizedAt: invFinalizedAt,
            hasMissingFinalizedAt: !invFinalizedAt,
            contractFound: !!contract,
            contractEndDate: contract?.endDate,
            contractPaidDays: contract?.paidDays,
            contractRemainingDays: contract?.remainingDays
        });
    }

    // También buscar invoices pagadas esta semana directamente
    const paidInvoicesThisWeek = await db.collection('invoices').find({
        $or: [
            { 'transaction.finalized_at': { $gte: startOfWeek } },
            { paymentDate: { $gte: startOfWeek } },
            { updatedAt: { $gte: startOfWeek } }
        ],
        paid: true
    }).toArray();

    console.log(`Total facturas marcadas paid esta semana: ${paidInvoicesThisWeek.length}`);

    // Invoices donde paid: true pero transaction.finalized_at o paymentDate es null / no existe
    const invoicesPaidWithoutFinalizedAt = await db.collection('invoices').find({
        paid: true,
        $or: [
            { 'transaction.finalized_at': null },
            { 'transaction.finalized_at': { $exists: false } },
            { paymentDate: null },
            { paymentDate: { $exists: false } }
        ],
        $or: [
            { updatedAt: { $gte: startOfWeek } },
            { date: { $gte: new Date('2026-11-01T00:00:00.000Z') } }
        ]
    }).toArray();

    console.log('--- Resumen de Invoices Pagadas sin finalized_at en transaction ---');
    console.log(`Invoices encontradas: ${invoicesPaidWithoutFinalizedAt.length}`);
    for (const inv of invoicesPaidWithoutFinalizedAt) {
        console.log({
            _id: inv._id,
            deviceIdName: inv.deviceIdName,
            date: inv.date,
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            paid: inv.paid,
            paymentDate: inv.paymentDate,
            transaction: inv.transaction
        });
    }

    console.log('\n--- Detalle de pagos de la semana y sus invoices vinculadas ---');
    console.log(JSON.stringify(invoiceIssues, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);

