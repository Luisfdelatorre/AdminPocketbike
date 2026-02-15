import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import authService from '../server/services/authService.js';
import { User } from '../server/models/User.js';

async function forceCreateAdmin() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDatabase();

        const email = 'admin@pocketbike.app';
        const password = 'Admin123!';
        const name = 'Admin User';

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log(`⚠️ User ${email} already exists. Updating password...`);
            // You might need a method to update password, or delete and recreate.
            // For simplicity, let's delete and recreate to ensure clean state.
            await User.deleteOne({ email });
            console.log('🗑️ Existing user deleted.');
        }

        console.log('\n🔐 Creating admin user...');

        const user = await authService.registerUser({
            email,
            password,
            name,
            role: 'admin',
            permissions: ['all'],
            companyName: 'System' // Ensure system admin access
        });

        console.log('\n✅ Admin user created successfully!');
        console.log(`📧 Email: ${user.email}`);
        console.log(`👤 Name: ${user.name}`);
        console.log(`🎖️  Role: ${user.role}`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
    } finally {
        await disconnectDatabase();
    }
}

forceCreateAdmin();
