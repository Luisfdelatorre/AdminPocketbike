import mongoose from 'mongoose';
import companyRepository from '../repositories/companyRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import companyService from '../services/companyService.js';
import { syncDailyKm } from '../cron-server/jobs/syncDailyKm.js';
import { Invoice } from '../models/Invoice.js';
import { Company } from '../models/Company.js';
import dayjs from '../config/dayjs.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function diagnoseSyncKm() {
    console.log('=== DIAGNOSTICO DE SINCRONIZACION DE KILOMETROS ===\n');
    await mongoose.connect(MONGODB_URI);


    console.log('\n--- Ejecutando función principal syncDailyKm() ---');
    await syncDailyKm();
    console.log('\n=== DIAGNOSTICO FINALIZADO ===');
    await mongoose.disconnect();
    process.exit(0);
}

diagnoseSyncKm().catch(err => {
    console.error('Error en diagnóstico:', err);
    mongoose.disconnect();
    process.exit(1);
});
