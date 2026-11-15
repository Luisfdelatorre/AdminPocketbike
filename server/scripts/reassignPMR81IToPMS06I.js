import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { Invoice, Payment, Contract, Device } from '../models/index.js';

async function migrate() {
    try {
        await connectDatabase();
        console.log('🚀 Iniciando traslado de PMR81I a PMS06I (CIPMS06I0S)...');

        const OLD_PLATE = 'PMR81I';
        const NEW_PLATE = 'PMS06I';
        const NEW_DEVICE_ID = '86817265';
        const NEW_GPS_ID = 291;
        const NEW_CONTRACT_ID = 'CIPMS06I0S';
        const OLD_CONTRACT_ID = 'CIPMR81IBP';

        // 1. Migrar Invoices (recreando con nuevo _id en la colección)
        const oldInvoices = await Invoice.find({ deviceIdName: OLD_PLATE }).lean();
        console.log(`📋 Encontradas ${oldInvoices.length} facturas para ${OLD_PLATE}`);

        let invoicesMigrated = 0;
        for (const inv of oldInvoices) {
            const dateStr = inv._id.replace(`${OLD_PLATE}-`, '');
            const newInvoiceId = `${NEW_PLATE}-${dateStr}`;

            const newInvoiceData = {
                ...inv,
                _id: newInvoiceId,
                invoiceId: newInvoiceId,
                deviceIdName: NEW_PLATE,
                deviceId: NEW_DEVICE_ID,
                gpsId: NEW_GPS_ID,
                contractId: NEW_CONTRACT_ID
            };

            // Eliminar si ya existe por alguna prueba previa
            await Invoice.collection.deleteOne({ _id: newInvoiceId });
            await Invoice.collection.insertOne(newInvoiceData);
            await Invoice.collection.deleteOne({ _id: inv._id });
            invoicesMigrated++;
        }
        console.log(`✅ ${invoicesMigrated} facturas migradas exitosamente a ${NEW_PLATE}`);

        // 2. Actualizar Payments
        const oldPayments = await Payment.find({ deviceIdName: OLD_PLATE });
        console.log(`📋 Encontrados ${oldPayments.length} pagos para ${OLD_PLATE}`);

        let paymentsMigrated = 0;
        for (const p of oldPayments) {
            p.deviceIdName = NEW_PLATE;
            p.deviceId = NEW_DEVICE_ID;
            p.gpsId = NEW_GPS_ID;
            p.contractId = NEW_CONTRACT_ID;
            if (p.invoiceId && typeof p.invoiceId === 'string') {
                p.invoiceId = p.invoiceId.replace(OLD_PLATE, NEW_PLATE);
            }
            if (p.unpaidInvoiceId && typeof p.unpaidInvoiceId === 'string') {
                p.unpaidInvoiceId = p.unpaidInvoiceId.replace(OLD_PLATE, NEW_PLATE);
            }
            if (Array.isArray(p.invoices)) {
                p.invoices = p.invoices.map(id => (typeof id === 'string' ? id.replace(OLD_PLATE, NEW_PLATE) : id));
            }
            await p.save();
            paymentsMigrated++;
        }
        console.log(`✅ ${paymentsMigrated} pagos actualizados para ${NEW_PLATE}`);

        // 3. Actualizar contrato nuevo CIPMS06I0S con los acumulados
        await Contract.updateOne(
            { contractId: NEW_CONTRACT_ID },
            {
                $set: {
                    paidAmount: 455000,
                    paidDays: 15,
                    contractDays: 470,
                    remainingDays: 455,
                    startDate: new Date('2026-10-17T05:00:00.000Z')
                }
            }
        );
        console.log(`✅ Contrato ${NEW_CONTRACT_ID} actualizado con 15 días y $455.000 pagados`);

        // 4. Cancelar contrato viejo CIPMR81IBP y liberar dispositivo PMR81I
        await Contract.updateOne(
            { contractId: OLD_CONTRACT_ID },
            { $set: { status: 'CANCELLED' } }
        );
        await Device.updateOne(
            { name: OLD_PLATE },
            {
                $set: {
                    hasActiveContract: false,
                    activeContractId: null,
                    contractId: null
                }
            }
        );
        console.log(`✅ Moto ${OLD_PLATE} liberada y contrato ${OLD_CONTRACT_ID} marcado como CANCELLED`);

        // 5. Asegurar datos en dispositivo PMS06I
        await Device.updateOne(
            { name: NEW_PLATE },
            {
                $set: {
                    hasActiveContract: true,
                    activeContractId: NEW_CONTRACT_ID,
                    contractId: NEW_CONTRACT_ID,
                    cutOffTime: '18:00',
                    dailyRate: 35000
                }
            }
        );
        console.log(`✅ Moto ${NEW_PLATE} asegurada con contrato ${NEW_CONTRACT_ID}`);

        console.log('🎉 Migración finalizada con éxito.');
    } catch (err) {
        console.error('❌ Error en migración:', err);
    } finally {
        await disconnectDatabase();
    }
}

migrate();

