import { connectDatabase } from '../server/database/connection.js';
import authService from '../server/services/authService.js';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

async function createAdminUser() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDatabase();

        console.log('\n📝 Create Admin User\n');
        console.log('This will create a new administrator account with full access.\n');

        const email = await question('Email: ');
        const name = await question('Name: ');
        const password = await question('Password: ');
        const confirmPassword = await question('Confirm Password: ');

        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match!');
            process.exit(1);
        }

        if (password.length < 8) {
            console.error('❌ Password must be at least 8 characters!');
            process.exit(1);
        }

        console.log('\n🔐 Creating admin user...');

        const user = await authService.registerUser({
            email,
            password,
            name,
            role: 'admin',
            permissions: ['all'],
        });

        console.log('\n✅ Admin user created successfully!');
        console.log(`📧 Email: ${user.email}`);
        console.log(`👤 Name: ${user.name}`);
        console.log(`🎖️  Role: ${user.role}`);
        console.log(`🆔 User ID: ${user.userId}`);
        console.log('\n🔑 You can now login with these credentials.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        process.exit(1);
    }
}

console.log('═══════════════════════════════════');
console.log('   Payments-Wompi Admin Setup');
console.log('═══════════════════════════════════\n');

createAdminUser();
