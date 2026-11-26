import reportTemplateService, { resolveCompanyId } from '../services/reportTemplateService.js';
import logger from '../config/logger.js';

const handleError = (res, error, action) => {
    if (error?.statusCode === 400) {
        return res.status(400).json({ success: false, error: error.message });
    }
    logger.error(`[reportTemplateController] ${action} error: ${error?.message}`);
    return res.status(500).json({ success: false, error: 'Report template operation failed' });
};

const withCompany = (handler, action) => async (req, res) => {
    const companyId = resolveCompanyId(req.auth);
    if (!companyId) {
        return res.status(400).json({ success: false, error: 'An active company is required' });
    }
    try {
        return await handler(req, res, companyId);
    } catch (error) {
        return handleError(res, error, action);
    }
};

export const reportTemplateController = {
    list: withCompany(async (req, res, companyId) => {
        const data = await reportTemplateService.listTemplates(companyId);
        return res.json({ success: true, data });
    }, 'list'),

    getByKey: withCompany(async (req, res, companyId) => {
        const data = await reportTemplateService.getTemplate(companyId, req.params.key);
        if (!data) return res.status(404).json({ success: false, error: 'Report template not found' });
        return res.json({ success: true, data });
    }, 'getByKey'),

    save: withCompany(async (req, res, companyId) => {
        const data = await reportTemplateService.saveTemplate(companyId, req.params.key, req.body, req.auth?.userId);
        return res.json({ success: true, data });
    }, 'save'),

    reset: withCompany(async (req, res, companyId) => {
        const data = await reportTemplateService.resetTemplate(companyId, req.params.key);
        return res.json({ success: true, data });
    }, 'reset'),
};

export default reportTemplateController;
