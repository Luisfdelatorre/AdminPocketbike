import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import companyService from '../services/companyService.js';
import dayjs from '../config/dayjs.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function checkCompanyCutOff() {
    console.log('=== DIAGNOSTICO DE CONFIGURACION DE CORTE Y DEUDA ===\n');
    await mongoose.connect(MONGODB_URI);
    
    const now = dayjs();
    console.log(`⏰ Hora local actual del servidor: ${now.format('YYYY-MM-DD HH:mm:ss')} (Hora actual: ${now.format('HH:mm')})\n`);

    const companies = await Company.find({}).lean();
    console.log(`🏢 Total de compañías en base de datos: ${companies.length}\n`);

    for (const company of companies) {
        console.log(`📌 Compañía: ${company.name} (_id: ${company._id})`);
        console.log(`   - Activa (isActive): ${company.isActive}`);
        console.log(`   - Estrategia de Corte (cutOffStrategy): ${company.cutOffStrategy ?? 1} (${
            company.cutOffStrategy === 1 ? 'Apagar si debe hoy' :
            company.cutOffStrategy === 2 ? 'Apagar si debe ayer' :
            company.cutOffStrategy === 3 ? 'No apagar' : 'Por defecto 1'
        })`);
        console.log(`   - Hora de Corte (cutOffTime): "${company.cutOffTime || 'No definida (Por defecto 23:59)'}"`);
        console.log(`   - Apagado Automático Habilitado (automaticCutOff): ${company.automaticCutOff ?? false}`);
        console.log(`   - Horarios / Schedules:`, company.schedules || []);

        const isDueToday = companyService.isInvoiceDue(company, now.toDate(), now);
        console.log(`   👉 ¿La factura de HOY (${now.format('YYYY-MM-DD')}) se considera DEUDA a esta hora (${now.format('HH:mm')})?: ${isDueToday ? 'SI 🔴' : 'NO 🟢'}`);
        console.log('--------------------------------------------------\n');
    }

    await mongoose.disconnect();
    process.exit(0);
}

checkCompanyCutOff().catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
    process.exit(1);
});
