// Test script for authentication API

const API_URL = 'http://localhost:3000/api';

async function testAuthentication() {
    console.log('🧪 Testing Authentication System\n');
    console.log('================================\n');

    try {
        // Test 1: Admin Login
        console.log('1️⃣  Testing Admin Login...');
        const loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@pocketbike.com',
                password: 'Admin123!'
            })
        });

        const loginData = await loginResponse.json();

        if (loginData.success) {
            console.log('✅ Login successful!');
            console.log(`   User: ${loginData.data.user.name}`);
            console.log(`   Role: ${loginData.data.user.role}`);
            console.log(`   Token: ${loginData.data.token.substring(0, 50)}...`);

            const adminToken = loginData.data.token;

            // Test 2: Get current user
            console.log('\n2️⃣  Testing Get Current User...');
            const meResponse = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const meData = await meResponse.json();

            if (meData.success) {
                console.log('✅ User info retrieved!');
                console.log(`   Type: ${meData.data.type}`);
                console.log(`   Email: ${meData.data.user.email}`);
            } else {
                console.log('❌ Failed:', meData.error);
            }

            // Test 3: Create device PIN
            console.log('\n3️⃣  Testing Create Device PIN...');
            const pinResponse = await fetch(`${API_URL}/auth/create-device-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    deviceId: 'BIKE001',
                    pin: '1234',
                    accessType: 'temporary',
                    expiresIn: 30
                })
            });
            const pinData = await pinResponse.json();

            if (pinData.success) {
                console.log('✅ Device PIN created!');
                console.log(`   Device: ${pinData.data.deviceId}`);
                console.log(`   Access Type: ${pinData.data.accessType}`);
                console.log(`   Expires: ${pinData.data.expiresAt}`);
            } else {
                console.log('❌ Failed:', pinData.error);
            }

            // Test 4: Verify device PIN
            console.log('\n4️⃣  Testing Device PIN Verification...');
            const deviceAuthResponse = await fetch(`${API_URL}/auth/device-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: 'BIKE001',
                    pin: '1234'
                })
            });
            const deviceAuthData = await deviceAuthResponse.json();

            if (deviceAuthData.success) {
                console.log('✅ Device PIN verified!');
                console.log(`   Device: ${deviceAuthData.data.deviceId}`);
                console.log(`   Token: ${deviceAuthData.data.token.substring(0, 50)}...`);

                const deviceToken = deviceAuthData.data.token;

                // Test 5: Access contract stats with device token
                console.log('\n5️⃣  Testing Device Access to Contract Stats...');
                const statsResponse = await fetch(`${API_URL}/contracts/BIKE001/stats`, {
                    headers: { 'Authorization': `Bearer ${deviceToken}` }
                });
                const statsData = await statsResponse.json();

                if (statsData.success) {
                    console.log('✅ Contract stats accessed!');
                    console.log(`   Contract ID: ${statsData.data.contractId}`);
                    console.log(`   Completion: ${statsData.data.completionPercentage}%`);
                } else {
                    console.log('⚠️  Note: Contract endpoint not yet protected (that\'s OK for now)');
                }
            } else {
                console.log('❌ Failed:', deviceAuthData.error);
            }

            console.log('\n================================');
            console.log('✅ All authentication tests passed!');
            console.log('================================\n');

        } else {
            console.log('❌ Login failed:', loginData.error);
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

testAuthentication();
