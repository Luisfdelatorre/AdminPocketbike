import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';
import companyRepository from '../repositories/companyRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import companyService from '../services/companyService.js';

async function initializeOdometers() {
    try {
        await mongoose.connect(MongoDB.URI);
        console.log('Conectado a MongoDB...');
        const companies = await companyRepository.getActiveCompanies();
        console.log(`Empresas operativas a procesar: ${companies.length}`);

        let totalInitialized = 0;

        for (const company of companies) {
            console.log(`\nProcesando empresa: ${company.name} (ID: ${company._id})...`);
            const gpsAdapter = await companyService.getGpsAdapterByCompany(company._id);
            const odoMap = await gpsAdapter.fetchLatestOdometerMap();
            const positionsCount = Object.keys(odoMap).length;
            console.log(`  Posiciones con odómetro en Traccar: ${positionsCount}`);

            if (positionsCount === 0) continue;

            const devices = await deviceRepository.getDevicesByCompanyId(company._id);
            console.log(`  Dispositivos en base de datos: ${devices.length}`);

            const updateItems = [];
            for (const dev of devices) {
                const gpsKey = dev.gpsId != null ? String(dev.gpsId).trim() : null;
                if (gpsKey && odoMap[gpsKey] != null) {
                    updateItems.push({
                        deviceId: dev._id,
                        totalKm: odoMap[gpsKey]
                    });
                }
            }

            if (updateItems.length > 0) {
                const res = await deviceRepository.bulkUpdateDeviceOdometers(updateItems);
                console.log(`  ✅ Odómetros inicializados en BD: ${res.modifiedCount || updateItems.length}`);
                totalInitialized += (res.modifiedCount || updateItems.length);
            }
        }

        console.log(`\n=== INICIALIZACIÓN COMPLETADA ===`);
        console.log(`Total odómetros establecidos: ${totalInitialized}`);
    } catch (e) {
        console.error('Error inicializando odómetros:', e);
    } finally {
        await mongoose.disconnect();
    }
}

initializeOdometers();
