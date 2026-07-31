import reportTemplateService from '../services/reportTemplateService.js';
import logger from '../config/logger.js';

export const reportTemplateController = {
    getAllTemplates: async (req, res) => {
        try {
            const { module: moduleName } = req.query;
            const filter = moduleName ? { module: moduleName } : {};
            const templates = await reportTemplateService.getAllTemplates(filter);

            return res.json({
                success: true,
                data: templates
            });
        } catch (error) {
            logger.error('[reportTemplateController] getAllTemplates error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error fetching report templates'
            });
        }
    },

    getTemplateByKey: async (req, res) => {
        try {
            const { key } = req.params;
            const template = await reportTemplateService.getTemplateByKey(key);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: `Report template '${key}' not found`
                });
            }

            return res.json({
                success: true,
                data: template
            });
        } catch (error) {
            logger.error(`[reportTemplateController] getTemplateByKey error for ${req.params.key}:`, error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error fetching report template'
            });
        }
    },

    upsertTemplate: async (req, res) => {
        try {
            const { key } = req.params;
            const userId = req.user?._id || req.user?.id;
            const updatedTemplate = await reportTemplateService.upsertTemplate(key, req.body, userId);

            return res.json({
                success: true,
                message: `Report template '${key}' updated successfully`,
                data: updatedTemplate
            });
        } catch (error) {
            logger.error(`[reportTemplateController] upsertTemplate error for ${req.params.key}:`, error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Error updating report template'
            });
        }
    }
};

export default reportTemplateController;
