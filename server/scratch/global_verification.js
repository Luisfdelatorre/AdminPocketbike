import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function globalVerification() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    console.log('=== VERIFICACIÓN GLOBAL POST-CORRECCIÓN ===');

    // 1. Invoices sin contractId
    const missingContractIdCount = await db.collection('invoices').countDocuments({
        contractId: { $in: [null, undefined, ''] }
    });
    console.log(`1. Facturas sin contractId en toda la BD: ${missingContractIdCount}`);

    // 2. Facturas de fechas futuras indebidas (> 2026-11-15)
    const futureInvoicesCount = await db.collection('invoices').countDocuments({
        date: { $gte: new Date('2026-11-16T00:00:00.000Z') }
    });
    console.log(`2. Facturas futuras indebidas (> 2026-11-15): ${futureInvoicesCount}`);

    // 3. Revisión de saltos de mora en TODOS los contratos activos
    const activeContracts = await db.collection('contracts').find({ status: 'ACTIVE' }).toArray();
    let bikesWithGaps = 0;

    for (const contract of activeContracts) {
        const plate = contract.deviceIdName;
        const invoices = await db.collection('invoices').find({
            deviceIdName: plate,
            date: { $lte: new Date('2026-11-15T23:59:59.999Z') }
        }).sort({ date: 1 }).toArray();

        // Verificar si hay alguna factura impaga (no FREE) que tenga después una factura pagada (no FREE)
        let foundUnpaid = false;
        let firstUnpaidDate = null;
        let gapFound = false;

        for (const inv of invoices) {
            if (inv.dayType === 'FREE') continue;

            if (!inv.paid && !foundUnpaid) {
                foundUnpaid = true;
                firstUnpaidDate = inv.date?.toISOString()?.slice(0, 10);
            } else if (inv.paid && foundUnpaid) {
                gapFound = true;
                console.error(`❌ Salto detectado en ${plate}: Factura impaga en ${firstUnpaidDate} pero pagada en ${inv.date?.toISOString()?.slice(0, 10)}`);
                break;
            }
        }

        if (gapFound) {
            bikesWithGaps++;
        }
    }

    console.log(`3. Motos con saltos de mora restantes en la base de datos: ${bikesWithGaps}`);
    console.log('=== VERIFICACIÓN FINALIZADA ===');

    await mongoose.disconnect();
}

globalVerification().catch(console.error);

