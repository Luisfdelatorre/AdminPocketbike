import alertService from '../services/alertService.js';
import logger from '../config/logger.js';

export const getAlertsHistory = async (req, res) => {
    try {
        const { companyId, isSuperAdmin, role, companyName } = req.auth;
        const isSysAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const { month, year, type, severity, status, search, page, limit } = req.query;

        const result = await alertService.getAlertsHistory({
            companyId,
            isSuperAdmin: isSysAdmin,
            month,
            year,
            type,
            severity,
            status,
            search,
            page,
            limit
        });

        res.json(result);
    } catch (error) {
        logger.error('Error in getAlertsHistory controller:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAlertsStats = async (req, res) => {
    try {
        const { companyId, isSuperAdmin, role, companyName } = req.auth;
        const isSysAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const { month, year } = req.query;

        const result = await alertService.getAlertsStats({
            companyId,
            isSuperAdmin: isSysAdmin,
            month,
            year
        });

        res.json(result);
    } catch (error) {
        logger.error('Error in getAlertsStats controller:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateAlertStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const { userId, name, username } = req.auth;

        if (!status) {
            return res.status(400).json({ success: false, error: 'Status is required' });
        }

        const result = await alertService.updateAlertStatus(id, {
            status,
            notes,
            user: { userId, name, username }
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        logger.error('Error in updateAlertStatus controller:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export default {
    getAlertsHistory,
    getAlertsStats,
    updateAlertStatus
};
