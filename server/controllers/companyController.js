import authService from '../services/authService.js';
import companyService from '../services/companyService.js';

const companyController = {
    // Create new company
    createCompany: async (req, res) => {
        try {
            const { name } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            const company = await companyService.createCompany(req.body);

            res.status(201).json({
                success: true,
                data: company
            });

        } catch (error) {
            console.error('Error creating company:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Failed to create company'
            });
        }
    },

    // Update company
    updateCompany: async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            const company = await companyService.updateCompany(id, req.body, req.auth);

            res.json({
                success: true,
                data: company
            });

        } catch (error) {
            console.error('Error updating company:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Failed to update company'
            });
        }
    },

    // Get all companies (for dropdowns)
    getAllCompanies: async (req, res) => {
        try {
            const companies = await companyService.getAllCompanies(req.auth);

            res.json({
                success: true,
                data: companies
            });
        } catch (error) {
            console.error('Error fetching companies:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch companies'
            });
        }
    },

    // Get company branding (public endpoint with optional auth)
    getBranding: async (req, res) => {
        try {
            let companyId = null;

            // Check for auth token to get specific company
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const decoded = authService.verifyToken(token);
                    if (decoded && decoded.companyId) {
                        companyId = decoded.companyId;
                    }
                } catch (e) {
                    console.log('Optional auth failed in getBranding:', e.message);
                }
            }

            const branding = await companyService.getBranding(companyId);

            res.json({
                success: true,
                data: branding
            });
        } catch (error) {
            console.error('Error fetching branding:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch branding'
            });
        }
    },

    // Update company branding
    updateBranding: async (req, res) => {
        try {
            const { companyId } = req.auth;
            const branding = await companyService.updateBranding(companyId, req.body);

            res.json({
                success: true,
                data: branding
            });
        } catch (error) {
            console.error('Error updating branding:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Failed to update branding'
            });
        }
    },

    // Get full company settings (admin only)
    getSettings: async (req, res) => {
        try {
            const { companyId } = req.auth;
            const settings = await companyService.getCompanySettings(companyId);

            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Error fetching company settings:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Failed to fetch company settings'
            });
        }
    },

    // Update full company settings (admin only)
    updateSettings: async (req, res) => {
        try {
            const { companyId } = req.auth;
            const company = await companyService.updateCompanySettings(companyId, req.body);

            res.json({
                success: true,
                data: company
            });
        } catch (error) {
            console.error('Error updating company settings:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Failed to update company settings'
            });
        }
    },

    // Validate Traccar credentials and auto-discover group
    validateTraccar: async (req, res) => {
        try {
            const { companyId } = req.auth;
            const result = await companyService.validateTraccarCredentials({
                ...req.body,
                companyId
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error validating Traccar credentials:', error);
            res.status(error.statusCode || 400).json({
                success: false,
                error: error.message || 'Error al validar credenciales de Traccar'
            });
        }
    }
};

export default companyController;
