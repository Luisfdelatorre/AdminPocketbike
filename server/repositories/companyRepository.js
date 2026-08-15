import { Company } from '../models/Company.js';

class CompanyRepository {
    async getAllCompanies() {
        return await Company.find({}).lean();
    }

    async getCompaniesForDynamicCron() {
        return await Company.find(
            { $or: [{ automaticCutOff: true }, { 'curfew.enabled': true }, { 'schedules.enabled': true }], isActive: true },
            { _id: 1, automaticCutOff: 1, cutOffTime: 1, curfew: 1, schedules: 1 }
        ).lean();
    }
}

export default new CompanyRepository();
