import { User } from '../models/User.js';
import { Company } from '../models/Company.js';

const userController = {
    // Create new user (Admin function)
    // Create new user (Admin function)
    createUser: async (req, res) => {
        try {
            const {
                name,
                email,
                password,
                role,
                companyId
            } = req.body;

            const { isSuperAdmin, companyId: adminCompanyId, companyName: adminCompanyName, role: adminRole } = req.auth;

            const isSystemAdmin = isSuperAdmin || (adminRole === 'admin' && adminCompanyName === 'System');

            // Enforce company ID for non-super/system admins
            const targetCompanyId = isSystemAdmin ? companyId : adminCompanyId;

            if (!name || !email || !password || (isSystemAdmin && !companyId)) {
                // For super/system admin, companyId is required if creating for another company.
            }

            // Simplified validation
            if (!name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, email, and password are required'
                });
            }

            if (isSystemAdmin && !companyId) {
                return res.status(400).json({ success: false, error: 'Company is required for System/Super Admin' });
            }

            // Check if user exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'User with this email already exists'
                });
            }

            // Verify company exists
            const company = await Company.findById(targetCompanyId);
            if (!company) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid company selected' // or inferred
                });
            }

            // Create user
            // Note: Password hashing is handled by the pre-save hook in User model
            const user = await User.create({
                userId: email, // Using email as userId for now
                name,
                email,
                passwordHash: password, // Will be hashed
                role: role || 'viewer',
                companyId: company._id,
                companyName: company.name,
                isActive: true
            });

            // Return user without password
            const userResponse = user.toJSON();

            res.status(201).json({
                success: true,
                data: userResponse
            });

        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({
                success: false,
                error: error.code === 11000 ? 'Email already linked to another account' : 'Failed to create user'
            });
        }
    },

    // Get all users
    // Get all users
    getAllUsers: async (req, res) => {
        try {
            const { isSuperAdmin, companyId, companyName, role } = req.auth;
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

            let query = {};

            if (!isSystemAdmin) {
                // Return only users from the requester's company
                query.companyId = companyId;
            }

            const users = await User.find(query)
                .select('-passwordHash')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                data: users
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch users'
            });
        }
    },

    // Update user
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, email, password, role, companyId } = req.body;
            const { isSuperAdmin, companyId: adminCompanyId, companyName: adminCompanyName, role: adminRole } = req.auth;
            const isSystemAdmin = isSuperAdmin || (adminRole === 'admin' && adminCompanyName === 'System');

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Check permissions
            if (!isSystemAdmin && user.companyId !== adminCompanyId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to update this user'
                });
            }

            // Update fields
            if (name) user.name = name;
            if (email) user.email = email; // Note: Email changes might require re-verification regarding uniqueness if not handled
            if (role) user.role = role;
            if (password) user.passwordHash = password; // Pre-save hook will hash this

            // Update company info if provided
            if (isSystemAdmin && companyId) {
                const company = await Company.findById(companyId);
                if (company) {
                    user.companyId = company._id;
                    user.companyName = company.name;
                }
            }

            await user.save();

            const userResponse = user.toJSON();
            delete userResponse.passwordHash;

            res.json({
                success: true,
                data: userResponse
            });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({
                success: false,
                error: error.code === 11000 ? 'Email already linked to another account' : 'Failed to update user'
            });
        }
    },

    // Delete user
    // Delete user
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;
            const { isSuperAdmin, companyId, companyName, role } = req.auth;
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            // Check permissions
            if (!isSystemAdmin && user.companyId !== companyId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to delete this user'
                });
            }

            await User.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete user'
            });
        }
    }
};

export default userController;
