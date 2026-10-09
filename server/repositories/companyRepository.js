import { Company, decryptCompanyFields } from '../models/Company.js';

class CompanyRepository {
    async findById(id) {
        if (!id) return null;
        const doc = await Company.findById(id);
        return doc ? decryptCompanyFields(doc) : null;
    }

    async findByIdLean(id, select = null) {
        if (!id) return null;
        let query = Company.findById(id);
        if (select) query = query.select(select);
        const doc = await query.lean();
        return doc ? decryptCompanyFields(doc) : null;
    }

    async findByNit(nit) {
        if (!nit) return null;
        const doc = await Company.findOne({ nit });
        return doc ? decryptCompanyFields(doc) : null;
    }

    async findOne(filter = {}, select = null) {
        let query = Company.findOne(filter);
        if (select) query = query.select(select);
        const doc = await query.lean();
        return doc ? decryptCompanyFields(doc) : null;
    }

    async find(filter = {}, select = null, sort = null) {
        let query = Company.find(filter);
        if (select) query = query.select(select);
        if (sort) query = query.sort(sort);
        const docs = await query.lean();
        return Array.isArray(docs) ? docs.map(d => decryptCompanyFields(d)) : docs;
    }

    async create(data) {
        const doc = await Company.create(data);
        return decryptCompanyFields(doc);
    }

    async save(companyDoc) {
        const doc = await companyDoc.save();
        return decryptCompanyFields(doc);
    }

    async getAllCompanies() {
        const docs = await Company.find({}).lean();
        return docs.map(d => decryptCompanyFields(d));
    }

    async getCompaniesForDynamicCron() {
        return await Company.find(
            { $or: [{ automaticCutOff: true }, { 'curfew.enabled': true }, { 'schedules.enabled': true }], isActive: true, type: { $ne: 'system' } },
            { _id: 1, automaticCutOff: 1, cutOffTime: 1, curfew: 1, schedules: 1 }
        ).lean();
    }

    async getActiveCompanies() {
        const docs = await Company.find({ isActive: true, type: { $ne: 'system' } }).lean();
        return docs.map(d => decryptCompanyFields(d));
    }

    async getCompaniesForAutomaticInvoicing() {
        const docs = await Company.find({ automaticInvoicing: true, isActive: true, type: { $ne: 'system' } }).lean();
        return docs.map(d => decryptCompanyFields(d));
    }
}

export default new CompanyRepository();
