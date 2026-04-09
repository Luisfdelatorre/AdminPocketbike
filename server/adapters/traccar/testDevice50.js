import mongoose from 'mongoose';
import 'dotenv/config'; // Make sure it reads env variables
import { connectDatabase } from '../../database/connection.js';
import { Device } from '../../models/Device.js';
import companyService from '../../services/companyService.js';
import { ENGINE_COMMANDS } from '../../config/config.js';

const GPS_ID_TARGET = "50"; // Use string since it's typically stored as string

async function testDevice50() {
    console.log('🔌 Conectando a MongoDB para obtener la configuración de la empresa...');
    await connectDatabase();

    try {
        const device = await Device.findOne({ gpsId: GPS_ID_TARGET * 1 });
        if (!device) {
            console.error(`❌ El dispositivo con gpsId ${GPS_ID_TARGET} no se encontró en la base de datos de Pocketbike.`);
            process.exit(1);
        }

        console.log(`✅ Dispositivo encontrado! Company ID: ${device.companyId}`);
        const gpsService = await companyService.getGpsAdapter(device.companyId);

        console.log('\n[1] Consultando estado inicial (vía MyTraccar adapter internal)...');
        const statusBefore = await gpsService.adapter.getDetailedStatus(GPS_ID_TARGET);
        console.log('Estado Inicial:', statusBefore);

        console.log(`\n[2] Ejecutando GpsService.executeAndVerify (Ciclo Automático de backend)...`);

        const success = await gpsService.executeAndVerify(GPS_ID_TARGET, ENGINE_COMMANDS.RESUME);

        if (success) {
            console.log(`\n✅ ¡ÉXITO TOTAL! El dispositivo ${GPS_ID_TARGET} ejecutó y confirmó su cambio a ENGINE_RESUME.`);
        } else {
            console.log(`\n❌ ¡FALLA! El backend intentó las 12 veces (60 segundos) pero Traccar o el GPS no confirmaron el cambio.`);
        }

        console.log('\n[3] Consultando estado final...');
        const statusAfter = await gpsService.adapter.getDetailedStatus(GPS_ID_TARGET);
        console.log('Estado Final:', statusAfter);

    } catch (err) {
        console.error('\n❌ ERROR CRÍTICO durante el test:', err.message);
        if (err.response) {
            console.error('Detalles del error (Axios):', err.response.data);
        }
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testDevice50();
