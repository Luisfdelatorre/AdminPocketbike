import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';
import companyRepository from '../repositories/companyRepository.js';
import companyService from '../services/companyService.js';

async function testAzviKm() {
    try {
        await mongoose.connect(MongoDB.URI);
        const companies = await companyRepository.getActiveCompanies();
        const azvi = companies.find(c => c.name.includes('AZVI'));
        if (!azvi) {
            console.log('No se encontró MOTOS AZVI');
            return;
        }

        console.log(`Empresa: ${azvi.name} (_id: ${azvi._id}, groupId: ${azvi.traccarGroupId})`);
        const gpsAdapter = await companyService.getGpsAdapterByCompany(azvi._id);

        console.log('Consultando fetchPreviousDayKmDevice...');
        const kmData = await gpsAdapter.fetchPreviousDayKmDevice(new Date());

        console.log(`\n=== RESULTADO TRACCAR ===`);
        console.log(`Total registros recibidos: ${kmData?.length}`);
        if (kmData?.length > 0) {
            console.log('Primeros 5 registros:', JSON.stringify(kmData.slice(0, 5), null, 2));
            const conKm = kmData.filter(r => (r.distanceKm || 0) > 0);
            console.log(`Motos con distancia > 0: ${conKm.length}`);
            if (conKm.length > 0) {
                console.log('Muestra de motos con movimiento:', JSON.stringify(conKm.slice(0, 3), null, 2));
            }
        }
    } catch (e) {
        console.error('Error en test:', e);
    } finally {
        await mongoose.disconnect();
    }
}

testAzviKm();
