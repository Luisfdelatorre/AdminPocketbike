import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';
import companyRepository from '../repositories/companyRepository.js';
import companyService from '../services/companyService.js';

async function checkAzviPositions() {
    try {
        await mongoose.connect(MongoDB.URI);
        const companies = await companyRepository.getActiveCompanies();
        const azvi = companies.find(c => c.name.includes('AZVI'));
        const gpsAdapter = await companyService.getGpsAdapterByCompany(azvi._id);

        console.log('Consultando api/positions en Traccar...');
        const tStart = Date.now();
        const res = await gpsAdapter.adapter._api.getPositions();
        const duration = Date.now() - tStart;

        console.log(`⏱️ Tiempo de respuesta api/positions: ${duration}ms`);
        console.log(`Total posiciones recibidas: ${res.data?.length}`);
        if (res.data?.length > 0) {
            console.log('Muestra de posición 1:', JSON.stringify(res.data[0], null, 2));
            const withOdo = res.data.filter(p => p.attributes?.totalDistance != null || p.attributes?.odometer != null);
            console.log(`Posiciones con totalDistance u odometer: ${withOdo.length}/${res.data.length}`);
            if (withOdo.length > 0) {
                console.log('Atributos de odómetro muestra:', {
                    deviceId: withOdo[0].deviceId,
                    totalDistance: withOdo[0].attributes?.totalDistance,
                    odometer: withOdo[0].attributes?.odometer
                });
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkAzviPositions();
