import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { nanoid } from 'nanoid';

const seedSuperAdmin = async () => {
    try {
        const email = 'admin@pocketbike.app';
        const password = 'Admin123!';
        const name = 'Super Admin';

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            // Ensure isSuperAdmin is true
            if (!user.isSuperAdmin) {
                user.isSuperAdmin = true;
                await user.save();
                console.log('✅ Updated existing admin to Super Admin');
            }
            return;
        }

        console.log('👤 Creating Super Admin user...');

        // Ensure a default company exists for the super admin (optional but good for consistency)
        let company = await Company.findOne({ nit: '000000000' });
        if (!company) {
            company = await Company.create({
                name: 'System',
                nit: '000000000',
                email: 'system@pocketbike.app',
                address: 'System',
                phone: '0000000000'
            });
            console.log('🏢 Created default System company');
        }

        // Create Super Admin
        user = await User.create({
            userId: nanoid(),
            email,
            passwordHash: password, // Will be hashed by pre-save hook
            name,
            role: 'admin',
            permissions: ['all'],
            isActive: true,
            isSuperAdmin: true,
            companyId: company._id,
            companyName: company.name
        });

        console.log(`✅ Super Admin created: ${email} / ${password}`);

    } catch (error) {
        console.error('❌ Error seeding Super Admin:', error);
    }
};

export default seedSuperAdmin;
