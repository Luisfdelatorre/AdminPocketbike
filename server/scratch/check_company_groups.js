import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';
import companyRepository from '../repositories/companyRepository.js';

async function checkGroups() {
    try {
        await mongoose.connect(MongoDB.URI);
        const companies = await companyRepository.getActiveCompanies();
        console.log('--- EMPRESAS ACTIVAS Y SUS GRUPOS TRACCAR ---');
        companies.forEach(c => {
            console.log(`Empresa: ${c.name} | traccarGroupId: ${c.traccarGroupId} | gpsConfig.groupId: ${c.gpsConfig?.groupId} | gpsService: ${c.gpsService}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkGroups();
