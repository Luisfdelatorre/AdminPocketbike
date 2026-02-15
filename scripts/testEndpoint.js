// Script to simulate Frontend API call to Payment Summary Endpoint

const API_BASE = 'http://localhost:3000/apinode';

async function testEndpoint() {
    console.log('🧪 Testing Payment Summary Endpoint');

    try {
        // 1. Login to get token
        console.log('1️⃣  Logging in as Admin...');
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@pocketbike.app',
                password: 'Admin123!'
            })
        });

        const loginData = await loginRes.json();
        if (!loginData.success) {
            throw new Error(`Login failed: ${loginData.error}`);
        }

        const token = loginData.data.token;
        console.log('✅ Login successful. Token obtained.');

        // 2. Call Summary Endpoint
        console.log('\n2️⃣  Fetching Payment Summary for Feb 2026...');
        const summaryRes = await fetch(`${API_BASE}/payments/summary?month=2&year=2026`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const summaryData = await summaryRes.json();

        if (!summaryData.success) {
            throw new Error(`Summary fetch failed: ${summaryData.error}`);
        }

        console.log('✅ Summary data retrieved successfully.');
        console.log(`   Count: ${summaryData.data.length} devices`);

        // 3. Inspect specific device structure
        const targetDevice = summaryData.data.find(d => d.device.name === 'XZQ78H');
        if (targetDevice) {
            console.log('\n🔍 Inspecting Device XZQ78H Data Structure:');
            console.log(JSON.stringify(targetDevice, null, 2));

            // Validate expected structure for Frontend
            // Frontend expects: item.days[day] = { totalPaid, count, ... }
            const day14 = targetDevice.days['14'];
            if (day14) {
                console.log('\n✅ Data for Day 14 found:');
                console.log('   totalPaid:', day14.totalPaid);
                console.log('   count:', day14.count);

                if (day14.totalPaid === 70000) {
                    console.log('   MATCHES EXPECTATION: 70000 (Grouped by Payment Date)');
                } else {
                    console.log('   ⚠️ VALUE MISMATCH');
                }
            } else {
                console.log('   ⚠️ No data for Day 14');
            }

            const day11 = targetDevice.days['11'];
            if (day11) {
                console.log('\n✅ Data for Day 11 found:');
                console.log('   cutOff:', day11.cutOff);
                if (day11.cutOff === true) {
                    console.log('   MATCHES EXPECTATION: cutOff is TRUE');
                } else {
                    console.log('   ⚠️ VALUE MISMATCH: cutOff should be TRUE');
                }
            }

            const day12 = targetDevice.days['12'];
            if (day12) {
                console.log('\n✅ Data for Day 12 found:');
                console.log('   provisionalPass:', day12.provisionalPass);
                if (day12.provisionalPass === true) {
                    console.log('   MATCHES EXPECTATION: provisionalPass is TRUE');
                } else {
                    console.log('   ⚠️ VALUE MISMATCH: provisionalPass should be TRUE');
                }
            }
        } else {
            console.log('   ⚠️ Device XZQ78H not found in summary');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testEndpoint();
