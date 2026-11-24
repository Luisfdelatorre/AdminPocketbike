import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function analyzeAll9() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    // Actualizar el único que faltaba
    await db.collection('invoices').updateOne({ _id: 'XZQ69H-2026-02-19' }, { $set: { contractId: 'CIXZQ69HNO' } });

    const plates = [
        'IFG81I',
        'DPW20I',
        'IFI90I',
        'IFX27I',
        'IGE18I',
        'XZQ63H',
        'XZQ69H',
        'XZQ86H',
        'YAG34H'
    ];

    const report = [];

    for (const plate of plates) {
        const contract = await db.collection('contracts').findOne({ deviceIdName: plate, status: 'ACTIVE' });
        
        // Facturas impagas más viejas (hasta 2026-11-14)
        const unpaidOlder = await db.collection('invoices').find({
            deviceIdName: plate,
            paid: false,
            dayType: { $ne: 'FREE' },
            date: { $lte: new Date('2026-11-14T23:59:59.999Z') }
        }).sort({ date: 1 }).toArray();

        // Facturas pagadas en fechas >= 2026-11-12 que tienen TxRef que apunta a una fecha anterior o que se crearon en el salto
        const paidNewer = await db.collection('invoices').find({
            deviceIdName: plate,
            paid: true,
            dayType: 'PAID',
            date: { $gte: new Date('2026-11-12T00:00:00.000Z') }
        }).sort({ date: 1 }).toArray();

        const paymentsToReassign = [];
        for (const inv of paidNewer) {
            const p = await db.collection('payments').findOne({
                $or: [
                    { _id: inv.transaction?.id },
                    { reference: inv.transaction?.reference }
                ]
            });
            paymentsToReassign.push({
                invoiceId: inv._id,
                invoiceDate: inv.date?.toISOString()?.slice(0, 10),
                txRef: inv.transaction?.reference,
                paymentId: p?._id,
                paymentAmount: p?.amount,
                paymentFinalizedAt: p?.finalized_at,
                paymentUnpaidInvId: p?.unpaidInvoiceId
            });
        }

        report.push({
            plate,
            contractId: contract?.contractId,
            dailyRate: contract?.dailyRate,
            unpaidOlderCount: unpaidOlder.length,
            unpaidOlderDates: unpaidOlder.map(u => u.date?.toISOString()?.slice(0, 10)),
            paidNewerCount: paidNewer.length,
            paidNewerDates: paidNewer.map(n => n.date?.toISOString()?.slice(0, 10)),
            paymentsToReassign
        });
    }

    console.log(JSON.stringify(report, null, 2));

    await mongoose.disconnect();
}

analyzeAll9().catch(console.error);

