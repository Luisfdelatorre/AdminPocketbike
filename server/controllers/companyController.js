import { Company } from '../models/Company.js';
import authService from '../services/authService.js';

const companyController = {
    // Create new company
    createCompany: async (req, res) => {
        try {
            const { name, nit, address, phone, email } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            // Check if company exists (by NIT if provided)
            if (nit) {
                const existingCompany = await Company.findOne({ nit });
                if (existingCompany) {
                    return res.status(400).json({
                        success: false,
                        error: 'Company with this NIT already exists'
                    });
                }
            }

            const company = await Company.create({
                name,
                nit,
                address,
                phone,
                address,
                phone,
                email,
                automaticInvoicing: req.body.automaticInvoicing || false
            });

            res.status(201).json({
                success: true,
                data: company
            });

        } catch (error) {
            console.error('Error creating company:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create company'
            });
        }
    },

    // Update company
    updateCompany: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, nit, address, phone, email, automaticInvoicing } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            // Find company to update
            const company = await Company.findById(id);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Check authorization (if not super admin, can only update own company)
            // Note: Middleware already verifies token, but we should check permissions
            const { isSuperAdmin, companyId, role } = req.auth;
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && req.auth.companyName === 'System');

            if (!isSystemAdmin && companyId !== id) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to update this company'
                });
            }

            // Check if NIT is changing and if it conflicts
            if (nit && nit !== company.nit) {
                const existingCompany = await Company.findOne({ nit });
                if (existingCompany) {
                    return res.status(400).json({
                        success: false,
                        error: 'Company with this NIT already exists'
                    });
                }
            }

            // Update fields
            company.name = name;
            company.nit = nit;
            company.address = address;
            company.phone = phone;
            company.email = email;
            if (typeof automaticInvoicing !== 'undefined') company.automaticInvoicing = automaticInvoicing;

            await company.save();

            res.json({
                success: true,
                data: company
            });

        } catch (error) {
            console.error('Error updating company:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update company'
            });
        }
    },

    // Get all companies (for dropdowns)
    getAllCompanies: async (req, res) => {
        try {
            const { isSuperAdmin, companyId, companyName, role } = req.auth;
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

            let query = { isActive: true };

            if (!isSystemAdmin) {
                query._id = companyId;
            }

            const companies = await Company.find(query)
                .select('name nit address phone email automaticInvoicing _id')
                .sort({ name: 1 });

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
                    // Ignore invalid token, fallback to default
                    console.log('Optional auth failed in getBranding:', e.message);
                }
            }

            let company;
            if (companyId) {
                // If authenticated, try to find user's company
                company = await Company.findById(companyId).select('displayName logo automaticCutOff cutOffStrategy').lean();
            }

            // Fallback: Get the first active company
            if (!company) {
                company = await Company.findOne({ isActive: true })
                    .select('displayName logo automaticCutOff cutOffStrategy')
                    .lean();
            }

            if (!company) {
                return res.json({
                    success: true,
                    data: {
                        displayName: 'PocketBike',
                        logo: '/pocketbike_60x60.jpg'
                    }
                });
            }

            res.json({
                success: true,
                data: {
                    displayName: company.displayName || 'PocketBike',
                    logo: company.logo || '/pocketbike_60x60.jpg',
                    automaticCutOff: company.automaticCutOff || false,
                    cutOffStrategy: company.cutOffStrategy || 1
                }
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
            const { displayName, logo, automaticCutOff, cutOffStrategy } = req.body;
            const { companyId } = req.auth;

            const company = await Company.findById(companyId);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            if (displayName !== undefined) company.displayName = displayName;
            if (logo !== undefined) company.logo = logo;
            if (automaticCutOff !== undefined) company.automaticCutOff = automaticCutOff;
            if (cutOffStrategy !== undefined) company.cutOffStrategy = Boolean(automaticCutOff) ? cutOffStrategy : 3;

            await company.save();

            res.json({
                success: true,
                data: {
                    displayName: company.displayName,
                    logo: company.logo,
                    automaticCutOff: company.automaticCutOff,
                    cutOffStrategy: company.cutOffStrategy
                }
            });
        } catch (error) {
            console.error('Error updating branding:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update branding'
            });
        }
    },
    // Get full company settings (admin only)
    getSettings: async (req, res) => {
        try {
            const { companyId } = req.auth;
            const company = await Company.findById(companyId);

            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Mask sensitive data for transport
            const maskedData = company.toObject();
            if (maskedData.gpsConfig) {
                if (maskedData.gpsConfig.password) maskedData.gpsConfig.password = '********';
                if (maskedData.gpsConfig.token) maskedData.gpsConfig.token = '********';
            }
            if (maskedData.wompiConfig) {
                if (maskedData.wompiConfig.privateKey) maskedData.wompiConfig.privateKey = '********';
                if (maskedData.wompiConfig.integritySecret) maskedData.wompiConfig.integritySecret = '********';
                if (maskedData.wompiConfig.eventsSecret) maskedData.wompiConfig.eventsSecret = '********';
            }

            res.json({
                success: true,
                data: maskedData
            });
        } catch (error) {
            console.error('Error fetching company settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch company settings'
            });
        }
    },

    // Update full company settings (admin only)
    updateSettings: async (req, res) => {
        try {
            const { companyId } = req.auth;
            const updates = req.body;

            const company = await Company.findById(companyId);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Allowed fields for update
            const allowedFields = [
                'name', 'nit', 'address', 'phone', 'email', 'automaticInvoicing',
                'displayName', 'logo', 'automaticCutOff', 'cutOffStrategy',
                'gpsService', 'gpsConfig', 'wompiConfig', 'contractDefaults'
            ];

            allowedFields.forEach(field => {
                if (updates[field] !== undefined) {
                    company[field] = updates[field];
                }
            });

            await company.save();

            res.json({
                success: true,
                data: company
            });
        } catch (error) {
            console.error('Error updating company settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update company settings'
            });
        }
    }
}

export default companyController;
