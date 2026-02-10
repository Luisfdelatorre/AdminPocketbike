import { Company } from '../models/Company.js';

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
                email
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
            const { name, nit, address, phone, email } = req.body;

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
                .select('name nit address phone email _id')
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
    }
};

export default companyController;
