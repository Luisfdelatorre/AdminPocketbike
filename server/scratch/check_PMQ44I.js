import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    try {
        await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
        const db = mongoose.connection.db;

        console.log('--- 1. BUSCANDO DISPOSITIVO PMQ44I ---');
        const device = await db.collection('devices').findOne({
            $or: [
                { name: 'PMQ44I' },
                { deviceIdName: 'PMQ44I' },
                { plate: 'PMQ44I' }
            ]
        });
        console.log('Device:', JSON.stringify(device, null, 2));

        if (!device) {
            console.log('No se encontró el dispositivo PMQ44I');
            await mongoose.disconnect();
            return;
        }

        console.log('\n--- 2. BUSCANDO CONTRATOS ASOCIADOS ---');
        const contracts = await db.collection('contracts').find({
            $or: [
                { deviceIdName: 'PMQ44I' },
                { deviceId: device.id || device.deviceId },
                { _id: device.contractId }
            ]
        }).toArray();
        console.log(`Contratos encontrados: ${contracts.length}`);
        contracts.forEach(c => {
            console.log('Contract:', {
                _id: c._id,
                contractId: c.contractId,
                status: c.status,
                startDate: c.startDate,
                endDate: c.endDate,
                paymentFrequency: c.paymentFrequency,
                freeDayPolicy: c.freeDayPolicy,
                fixedFreeDayOfWeek: c.fixedFreeDayOfWeek,
                freeDaysLimit: c.freeDaysLimit,
                companyId: c.companyId,
                nequiNumber: c.nequiNumber
            });
        });

        console.log('\n--- 3. BUSCANDO COMPANY ---');
        const companyId = device.companyId || (contracts[0] && contracts[0].companyId);
        if (companyId) {
            const company = await db.collection('companies').findOne({ _id: companyId });
            console.log('Company:', {
                _id: company?._id,
                name: company?.name,
                contractDefaults: company?.contractDefaults,
                freeDaysLimit: company?.freeDaysLimit,
                freeDayPolicy: company?.freeDayPolicy,
                fixedFreeDayOfWeek: company?.fixedFreeDayOfWeek
            });
        }

        console.log('\n--- 4. FACTURAS RECIENTES (ÚLTIMOS 15 DÍAS) ---');
        const recentInvoices = await db.collection('invoices').find({
            $or: [
                { deviceIdName: 'PMQ44I' },
                { plate: 'PMQ44I' },
                { deviceId: device.id || device.deviceId }
            ],
            date: { $gte: new Date('2026-11-14T00:00:00.000Z') }
        }).sort({ date: 1 }).toArray();

        console.log(`Total facturas nov 14-24: ${recentInvoices.length}`);
        recentInvoices.forEach(inv => {
            const dayOfWeek = inv.date ? new Date(inv.date).toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' }) : '';
            console.log(JSON.stringify({
                date: inv.date?.toISOString()?.slice(0, 10),
                dayOfWeek,
                invoiceId: inv.invoiceId || inv._id,
                paid: inv.paid,
                amount: inv.amount,
                paidAmount: inv.paidAmount,
                type: inv.type,
                status: inv.status,
                adjustmentType: inv.adjustmentType,
                paymentMethod: inv.paymentMethod,
                transaction: inv.transaction,
                notes: inv.notes || inv.note,
                contractId: inv.contractId
            }, null, 2));
        });

        console.log('\n--- 5. PAGOS / TRANSACCIONES RECIENTES ---');
        const payments = await db.collection('payments').find({
            $and: [
                {
                    $or: [
                        { deviceIdName: 'PMQ44I' },
                        { plate: 'PMQ44I' },
                        { reference: /PMQ44I/i }
                    ]
                },
                {
                    $or: [
                        { created_at: { $gte: new Date('2026-11-14T00:00:00.000Z') } },
                        { createdAt: { $gte: new Date('2026-11-14T00:00:00.000Z') } }
                    ]
                }
            ]
        }).sort({ created_at: 1 }).toArray();
        console.log(`Total pagos nov 14-24: ${payments.length}`);
        payments.forEach(p => {
            console.log(JSON.stringify({
                ref: p.reference,
                status: p.status,
                amount: p.amount,
                created: p.created_at || p.createdAt,
                type: p.type || p.payment_method_type,
                invoiceId: p.invoiceId,
                unpaidInvoiceId: p.unpaidInvoiceId
            }, null, 2));
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
