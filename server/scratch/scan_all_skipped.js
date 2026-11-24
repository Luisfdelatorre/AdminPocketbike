import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function scanAllPlatesForSkippedInvoices() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    // Buscar todas las facturas impagas (paid: false, amount > 0) con fecha < 2026-11-12
    const unpaidOlder = await db.collection('invoices').find({
        date: { $gte: new Date('2026-10-01T00:00:00.000Z'), $lt: new Date('2026-11-12T00:00:00.000Z') },
        paid: false,
        dayType: { $ne: 'FREE' }
    }).toArray();

    const olderUnpaidPlates = new Set(unpaidOlder.map(i => i.deviceIdName));

    // Buscar de esas motos cuáles tienen facturas PAGADAS con fecha >= 2026-11-12
    const paidNewer = await db.collection('invoices').find({
        deviceIdName: { $in: Array.from(olderUnpaidPlates) },
        date: { $gte: new Date('2026-11-12T00:00:00.000Z') },
        paid: true,
        dayType: { $ne: 'FREE' }
    }).toArray();

    const suspectMap = {};
    for (const inv of paidNewer) {
        if (!suspectMap[inv.deviceIdName]) {
            suspectMap[inv.deviceIdName] = {
                olderUnpaid: unpaidOlder.filter(u => u.deviceIdName === inv.deviceIdName).map(u => ({ id: u._id, date: u.date?.toISOString()?.slice(0, 10) })),
                newerPaid: []
            };
        }
        suspectMap[inv.deviceIdName].newerPaid.push({
            id: inv._id,
            date: inv.date?.toISOString()?.slice(0, 10),
            txRef: inv.transaction?.reference
        });
    }

    console.log(`Motos con deudas anteriores pero con facturas pagadas en el 12-14 nov: ${Object.keys(suspectMap).length}`);
    console.log(JSON.stringify(suspectMap, null, 2));

    await mongoose.disconnect();
}

scanAllPlatesForSkippedInvoices().catch(console.error);

