import mongoose from 'mongoose';
import fs from 'fs';
import { MongoDB } from '../config/components/core.js';
import companyRepository from '../repositories/companyRepository.js';
import companyService from '../services/companyService.js';

async function generateAzviReport() {
    try {
        await mongoose.connect(MongoDB.URI);
        const companies = await companyRepository.getActiveCompanies();
        const azvi = companies.find(c => c.name.includes('AZVI'));
        if (!azvi) {
            console.log('No se encontró MOTOS AZVI');
            return;
        }

        const gpsAdapter = await companyService.getGpsAdapterByCompany(azvi._id);
        const kmData = await gpsAdapter.fetchPreviousDayKmDevice(new Date());

        // Sort descending by distanceKm
        const sorted = (kmData || []).sort((a, b) => (b.distanceKm || 0) - (a.distanceKm || 0));

        let md = `# Reporte de Kilometraje por Moto - MOTOS AZVI SAS\n\n`;
        md += `**Fecha analizada (día anterior):** 2026-09-25\n`;
        md += `**Total de motos registradas:** ${sorted.length}\n`;
        md += `**Motos con movimiento (> 0 km):** ${sorted.filter(m => (m.distanceKm || 0) > 0).length}\n`;
        const totalKm = sorted.reduce((acc, m) => acc + (m.distanceKm || 0), 0);
        md += `**Kilometraje total de la flota:** ${totalKm.toFixed(1)} km\n\n`;

        md += `| # | Placa (Moto) | ID Traccar | Distancia (km) | Odómetro Inicial (km) | Odómetro Final (km) |\n`;
        md += `| :---: | :--- | :---: | :---: | :---: | :---: |\n`;

        sorted.forEach((m, idx) => {
            const startOdo = m.startOdometer ? (m.startOdometer / 1000).toFixed(1) : '-';
            const endOdo = m.endOdometer ? (m.endOdometer / 1000).toFixed(1) : '-';
            md += `| ${idx + 1} | **${m.deviceName || 'Sin nombre'}** | ${m.deviceId} | **${m.distanceKm || 0} km** | ${startOdo} | ${endOdo} |\n`;
        });

        const artifactPath = 'C:/Users/luisd/.gemini/antigravity-ide/brain/338d994d-0723-4806-bffc-cd1b5830b8ee/reporte_motos_azvi.md';
        fs.writeFileSync(artifactPath, md, 'utf-8');
        console.log(`Reporte guardado exitosamente en: ${artifactPath}`);
        console.log(`Total motos: ${sorted.length}, Total km: ${totalKm.toFixed(1)}`);
    } catch (e) {
        console.error('Error generando reporte:', e);
    } finally {
        await mongoose.disconnect();
    }
}

generateAzviReport();
