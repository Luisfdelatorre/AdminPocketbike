import { ReportTemplate } from '../models/ReportTemplate.js';
import logger from '../config/logger.js';

class ReportTemplateRepository {
    async findByKey(key) {
        try {
            return await ReportTemplate.findOne({ key: key.toLowerCase() }).lean();
        } catch (error) {
            logger.error(`[ReportTemplateRepository] Error in findByKey for ${key}:`, error);
            throw error;
        }
    }

    async findAll(filter = {}) {
        try {
            return await ReportTemplate.find(filter).sort({ module: 1, name: 1 }).lean();
        } catch (error) {
            logger.error('[ReportTemplateRepository] Error in findAll:', error);
            throw error;
        }
    }

    async upsertByKey(key, templateData) {
        try {
            const cleanKey = key.toLowerCase();
            return await ReportTemplate.findOneAndUpdate(
                { key: cleanKey },
                { $set: { ...templateData, key: cleanKey } },
                { new: true, upsert: true, runValidators: true }
            ).lean();
        } catch (error) {
            logger.error(`[ReportTemplateRepository] Error in upsertByKey for ${key}:`, error);
            throw error;
        }
    }

    async deleteByKey(key) {
        try {
            return await ReportTemplate.findOneAndDelete({ key: key.toLowerCase() }).lean();
        } catch (error) {
            logger.error(`[ReportTemplateRepository] Error in deleteByKey for ${key}:`, error);
            throw error;
        }
    }
}

export default new ReportTemplateRepository();
