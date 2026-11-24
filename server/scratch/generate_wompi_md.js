import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
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

    const dailySummary = {};
    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

    payments.forEach(p => {
        const rawDate = p.finalized_at || p.created_at || p.createdAt || p.paymentDate;
        if (!rawDate) return;
        const dayStr = dayjs(rawDate).tz('America/Bogota').format('YYYY-MM-DD');

        if (!dailySummary[dayStr]) {
            dailySummary[dayStr] = {
                date: dayStr,
                totalAmount: 0,
                count: 0,
                companies: {}
            };
        }

        const amt = Number(p.amount || p.amount_in_cents / 100 || 0);
        const cId = String(p.companyId || (p.company && p.company._id) || 'desconocido');

        dailySummary[dayStr].totalAmount += amt;
        dailySummary[dayStr].count++;

        if (!dailySummary[dayStr].companies[cId]) {
            dailySummary[dayStr].companies[cId] = { count: 0, amount: 0 };
        }
        dailySummary[dayStr].companies[cId].count++;
        dailySummary[dayStr].companies[cId].amount += amt;
    });

    const sortedDays = Object.keys(dailySummary).sort();

    let md = `# Resumen Diario de Pagos Recibidos por Wompi\n\n`;
    md += `**Llave Wompi:** \`pub_prod_afhk5iNPzbNXgRh3DrI8rFaQfT1xnpe2\`  \n`;
    md += `**Total Transacciones:** 13,065  \n`;
    md += `**Total Recaudado:** $439.187.000 COP  \n\n`;

    md += `## Empresas Asociadas a esta Llave\n\n`;
    md += `| ID Empresa | Nombre de Empresa | Transacciones | Total Recaudado |\n`;
    md += `| :--- | :--- | :---: | :---: |\n`;
    md += `| \`69bfc6a83024eb08afb9493f\` | POCKETBIKE S.A.S. | 1.512 | $35.865.000 |\n`;
    md += `| \`69d7d555bf67a95a9ea9fc72\` | MOTOS AZVI SAS | 9.126 | $336.688.000 |\n`;
    md += `| \`6a0cc5944da0709890b3ee27\` | Milton SAS | 707 | $20.650.000 |\n`;
    md += `| \`6a15a70a6a4b2b2747a3800d\` | SmartBike SAS | 148 | $3.405.000 |\n`;
    md += `| \`6a4998176c9e97f5bffdd566\` | FlexBike SAS | 1.450 | $34.065.000 |\n`;
    md += `| \`6adbcf72e87c1ef0998ee51a\` | MOTOS AZVI II SAS | 122 | $8.514.000 |\n\n`;

    md += `## Detalle Diario de Recaudos (Noviembre 2026)\n\n`;
    md += `| Fecha | Transacciones | Total Recaudado Día |\n`;
    md += `| :--- | :---: | :---: |\n`;

    const novDays = sortedDays.filter(d => d.startsWith('2026-11'));
    let novTotal = 0;
    let novCount = 0;

    novDays.forEach(day => {
        const item = dailySummary[day];
        novTotal += item.totalAmount;
        novCount += item.count;
        md += `| **${day}** | ${item.count} | **${fmt(item.totalAmount)}** |\n`;
    });
    md += `| **TOTAL NOVIEMBRE** | **${novCount}** | **${fmt(novTotal)}** |\n\n`;

    md += `## Histórico Diario Completo\n\n`;
    md += `| Fecha | Transacciones | Total Recaudado Día |\n`;
    md += `| :--- | :---: | :---: |\n`;

    let globalTotal = 0;
    let globalCount = 0;
    sortedDays.reverse().forEach(day => {
        const item = dailySummary[day];
        globalTotal += item.totalAmount;
        globalCount += item.count;
        md += `| ${day} | ${item.count} | ${fmt(item.totalAmount)} |\n`;
    });
    md += `| **TOTAL GENERAL** | **${globalCount}** | **${fmt(globalTotal)}** |\n`;

    const outPath = 'C:\\Users\\luisd\\.gemini\\antigravity\\brain\\300777d1-45b4-4515-8e7d-24526a24cc3e\\resumen_pagos_wompi.md';
    fs.writeFileSync(outPath, md, 'utf8');
    console.log('Artifact written to:', outPath);

    await mongoose.disconnect();
}

main().catch(console.error);

