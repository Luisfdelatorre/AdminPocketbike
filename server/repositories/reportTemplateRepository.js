import { ReportTemplate } from '../models/ReportTemplate.js';

class ReportTemplateRepository {
    findByCompanyAndKey(companyId, key) {
        return ReportTemplate.findOne({ companyId, key }).lean();
    }

    findByCompany(companyId) {
        return ReportTemplate.find({ companyId }).lean();
    }

    upsert(companyId, key, data) {
        return ReportTemplate.findOneAndUpdate(
            { companyId, key },
            { $set: { ...data, companyId, key } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).lean();
    }

    deleteByCompanyAndKey(companyId, key) {
        return ReportTemplate.findOneAndDelete({ companyId, key }).lean();
    }
}

export default new ReportTemplateRepository();
