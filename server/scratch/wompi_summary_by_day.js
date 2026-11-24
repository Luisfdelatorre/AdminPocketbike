import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import dayjs from '../config/dayjs.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const targetKey = 'pub_prod_afhk5iNPzbNXgRh3DrI8rFaQfT1xnpe2';

    // 1. Buscar empresas con esa llave
    const companies = await db.collection('companies').find({}).toArray();
    console.log(`Total empresas encontradas: ${companies.length}`);

    const matchedCompanies = [];
    companies.forEach(c => {
        const wompiPub = c.wompiConfig?.publicKey || c.paymentGateways?.wompi?.publicKey || c.wompi?.publicKey;
        // Revisar también si está en settings o anidado
        const jsonStr = JSON.stringify(c);
        if (jsonStr.includes(targetKey)) {
            matchedCompanies.push(c);
        }
    });

    console.log(`\nEmpresas con la llave ${targetKey}: ${matchedCompanies.length}`);
    matchedCompanies.forEach(c => {
        console.log(`- ID: ${c._id} | Nombre: ${c.name}`);
    });

    const companyIds = matchedCompanies.map(c => c._id);
    const companyIdStrings = matchedCompanies.map(c => String(c._id));
    const allCompanyIdMatch = [...companyIds, ...companyIdStrings];

    // Si no encuentra empresas específicas o para asegurar:
    const paymentFilter = {
        status: { $in: ['APPROVED', 'S_APPROVED'] }
    };
    if (allCompanyIdMatch.length > 0) {
        paymentFilter.$or = [
            { companyId: { $in: allCompanyIdMatch } },
            { 'company._id': { $in: allCompanyIdMatch } }
        ];
    }

    // 2. Buscar pagos aprobados
    const payments = await db.collection('payments').find(paymentFilter).toArray();
    console.log(`\nTotal pagos aprobados para estas empresas: ${payments.length}`);

    // Agrupar por día (YYYY-MM-DD en hora de Colombia)
    const dailySummary = {};

    payments.forEach(p => {
        const rawDate = p.finalized_at || p.created_at || p.createdAt || p.paymentDate;
        if (!rawDate) return;
        const dayStr = dayjs(rawDate).tz('America/Bogota').format('YYYY-MM-DD');
        
        if (!dailySummary[dayStr]) {
            dailySummary[dayStr] = {
                date: dayStr,
                totalAmount: 0,
                count: 0,
                byCompany: {}
            };
        }

        const amt = Number(p.amount || p.amount_in_cents / 100 || 0);
        dailySummary[dayStr].totalAmount += amt;
        dailySummary[dayStr].count += 1;

        const cId = String(p.companyId || 'SinEmpresa');
        if (!dailySummary[dayStr].byCompany[cId]) {
            dailySummary[dayStr].byCompany[cId] = { count: 0, amount: 0 };
        }
        dailySummary[dayStr].byCompany[cId].count += 1;
        dailySummary[dayStr].byCompany[cId].amount += amt;
    });

    const sortedDays = Object.keys(dailySummary).sort();

    console.log('\n======================================================');
    console.log(' RESUMEN POR DÍA - PAGOS RECIBIDOS (WOMPI)');
    console.log('======================================================');

    let grandTotal = 0;
    let grandCount = 0;

    sortedDays.forEach(day => {
        const item = dailySummary[day];
        grandTotal += item.totalAmount;
        grandCount += item.count;
        const formattedAmount = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.totalAmount);
        console.log(`${day} | ${String(item.count).padStart(3, ' ')} transacciones | Total: ${formattedAmount}`);
    });

    console.log('======================================================');
    const grandFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(grandTotal);
    console.log(`TOTAL GENERAL: ${grandCount} transacciones | ${grandFormatted}`);
    console.log('======================================================\n');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

