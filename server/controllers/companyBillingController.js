import companyBillingService from '../services/companyBillingService.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

export const companyBillingController = {
    async getInvoices(req, res) {
        try {
            const { companyId } = req.query;
            const { isSuperAdmin, role, companyName } = req.auth || {};
            
            const query = {};
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

            if (!isSystemAdmin) {
                // If not system admin, restrict to their own company
                query.companyId = req.auth.companyId;
            } else if (companyId) {
                // System admin can filter by company
                query.companyId = companyId;
            }

            const invoices = await companyBillingService.getCompanyInvoices(query);
            res.json({ success: true, data: invoices });

        } catch (error) {
            logger.error('Error fetching company invoices:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
        }
    },

    async generateInvoice(req, res) {
        try {
            const { companyId, month, year } = req.body;
            
            if (!companyId || !month || !year) {
                return res.status(400).json({ success: false, error: 'companyId, month, and year are required' });
            }

            const { isSuperAdmin, role, companyName, companyId: authCompanyId } = req.auth || {};
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

            if (!isSystemAdmin && authCompanyId !== companyId) {
                return res.status(403).json({ success: false, error: 'Unauthorized to generate invoices for this company' });
            }

            const invoice = await companyBillingService.generateMonthlyCompanyInvoice(companyId, month, year);
            res.json({ success: true, data: invoice });

        } catch (error) {
            logger.error('Error generating company invoice:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to generate invoice' });
        }
    }
};
