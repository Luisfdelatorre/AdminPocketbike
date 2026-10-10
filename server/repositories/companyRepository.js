import { Company } from '../models/Company.js';

export class CompanyRepository {
    async getActiveCompanies() {
        return await Company.find({ isActive: { $ne: false } }).lean();
    }

    async getCompaniesForDynamicCron() {
        return await Company.find({ isActive: { $ne: false } }).lean();
    }

    async getCompanyById(companyId) {
        return await Company.findById(companyId).lean();
    }

    async getAllCompanies() {
        return await Company.find({}).lean();
    }
}

export default new CompanyRepository();
