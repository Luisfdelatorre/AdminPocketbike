import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import dayjs from '../config/dayjs.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const companyMap = {
        '69bfc6a83024eb08afb9493f': 'POCKETBIKE S.A.S.',
        '69d7d555bf67a95a9ea9fc72': 'MOTOS AZVI SAS',
        '6a0cc5944da0709890b3ee27': 'Milton SAS',
        '6a15a70a6a4b2b2747a3800d': 'SmartBike SAS',
        '6a4998176c9e97f5bffdd566': 'FlexBike SAS',
        '6adbcf72e87c1ef0998ee51a': 'MOTOS AZVI II SAS'
    };

    const companyIds = Object.keys(companyMap).map(id => new mongoose.Types.ObjectId(id));
    const companyIdStrs = Object.keys(companyMap);

    const paymentFilter = {
        status: { $in: ['APPROVED', 'S_APPROVED'] },
        $or: [
            { companyId: { $in: [...companyIds, ...companyIdStrs] } },
            { 'company._id': { $in: [...companyIds, ...companyIdStrs] } }
        ]
    };

    const payments = await db.collection('payments').find(paymentFilter).toArray();

    const companyTotals = {};
    Object.keys(companyMap).forEach(id => {
        companyTotals[id] = { name: companyMap[id], count: 0, amount: 0 };
    });

    const monthTotals = {};

    payments.forEach(p => {
        const amt = Number(p.amount || p.amount_in_cents / 100 || 0);
        const cId = String(p.companyId || (p.company && p.company._id) || '');
        if (companyTotals[cId]) {
            companyTotals[cId].count++;
            companyTotals[cId].amount += amt;
        }

        const rawDate = p.finalized_at || p.created_at || p.createdAt || p.paymentDate;
        if (rawDate) {
            const mStr = dayjs(rawDate).tz('America/Bogota').format('YYYY-MM');
            if (!monthTotals[mStr]) monthTotals[mStr] = { count: 0, amount: 0 };
            monthTotals[mStr].count++;
            monthTotals[mStr].amount += amt;
        }
    });

    console.log('=== TOTALES POR EMPRESA ===');
    Object.values(companyTotals).forEach(ct => {
        const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(ct.amount);
        console.log(`${ct.name.padEnd(22, ' ')} | ${String(ct.count).padStart(5, ' ')} txs | Total: ${fmt}`);
    });

    console.log('\n=== TOTALES POR MES ===');
    Object.keys(monthTotals).sort().forEach(m => {
        const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(monthTotals[m].amount);
        console.log(`${m} | ${String(monthTotals[m].count).padStart(5, ' ')} txs | Total: ${fmt}`);
    });

    await mongoose.disconnect();
}

main().catch(console.error);

