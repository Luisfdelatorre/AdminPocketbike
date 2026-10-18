import mongoose from 'mongoose';
import companyRepository from '../repositories/companyRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import companyService from '../services/companyService.js';
import dayjs from '../config/dayjs.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function syncEntireMonthKm() {
    console.log('=== SINCRONIZACION DE KILOMETRAJE DE TODO EL MES DE AGOSTO 2026 ===\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Base de datos conectada.\n');

    const companies = await companyRepository.getActiveCompanies();
    console.log(`🏢 Compañías activas a procesar: ${companies.length}\n`);

    // Days 1 to 27 of August 2026
    const days = [];
    for (let d = 1; d <= 27; d++) {
        days.push(`2026-08-${String(d).padStart(2, '0')}`);
    }

    let grandTotalUpdated = 0;

    for (const targetDayStr of days) {
        console.log(`\n📅 --- PROCESANDO DIA: ${targetDayStr} ---`);
        let dayTotalUpdated = 0;

        for (const company of companies) {
            try {
                const gpsAdapter = await companyService.getGpsAdapterByCompany(company._id);
                const fetchFn = gpsAdapter?.adapter?.fetchPreviousDayKmDevice || gpsAdapter?.fetchPreviousDayKmDevice;

                if (typeof fetchFn !== 'function') continue;

                const devices = await deviceRepository.getDevicesByCompanyId(company._id);
                const gpsIds = devices.map(d => d.gpsId).filter(Boolean);

                if (gpsIds.length === 0) continue;

                const kmData = await fetchFn.call(gpsAdapter.adapter || gpsAdapter, targetDayStr, gpsIds);
                if (!kmData || !Array.isArray(kmData)) continue;

                const kmMap = {};
                for (const report of kmData) {
                    if (report.deviceId != null) {
                        kmMap[String(report.deviceId).trim()] = report.distanceKm ?? 0;
                    }
                }

                const updateItems = [];
                for (const device of devices) {
                    if (!device.gpsId) continue;
                    const key = String(device.gpsId).trim();
                    const distanceKm = kmMap[key];
                    if (distanceKm === undefined) continue;

                    updateItems.push({
                        invoiceId: `${device.name}-${targetDayStr}`,
                        distance: distanceKm
                    });
                }

                if (updateItems.length > 0) {
                    const res = await invoiceRepository.bulkUpdateInvoiceDistances(updateItems);
                    const modifiedCount = res.modifiedCount || 0;
                    dayTotalUpdated += modifiedCount;
                    grandTotalUpdated += modifiedCount;
                }
            } catch (err) {
                console.error(`  ❌ Error en compañía ${company.name} para el día ${targetDayStr}:`, err.message);
            }
        }

        console.log(`✅ Día ${targetDayStr} finalizado: ${dayTotalUpdated} facturas actualizadas.`);
    }

    console.log(`\n==================================================`);
    console.log(`🎉 RESUMEN FINAL: ${grandTotalUpdated} facturas actualizadas en todo el mes.`);
    console.log(`==================================================\n`);

    await mongoose.disconnect();
    process.exit(0);
}

syncEntireMonthKm().catch(err => {
    console.error('Error sincronizando todo el mes:', err);
    mongoose.disconnect();
    process.exit(1);
});
