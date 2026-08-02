import { Company } from '../models/Company.js';

class CompanyRepository {
    async getAllCompanies() {
        return await Company.find({}).lean();
    }
}

export default new CompanyRepository();
