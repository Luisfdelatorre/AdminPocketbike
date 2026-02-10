import axios from 'axios';

const API_URL = 'http://127.0.0.1:3000/apinode';

const test = async () => {
    try {
        console.log("Logging in as Admin (Company Restricted)...");
        // Using same admin credentials from previous successful tests
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@pocketbike.app',
            password: 'Admin123!'
        });

        const token = loginRes.data.data?.token || loginRes.data.token;
        console.log("Logged in:", !!token);

        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log("\n--- Testing GET /contracts/all ---");
        const contractsRes = await axios.get(`${API_URL}/contracts/all`, config);
        const contracts = contractsRes.data.contracts || contractsRes.data.data;
        console.log("Success:", contractsRes.data.success);
        console.log("Contract Count:", contracts.length);
        if (contracts.length > 0) {
            console.log("Sample Contract Device:", contracts[0].deviceIdName);
        }

        console.log("\n--- Testing GET /contracts/devices ---");
        const devicesRes = await axios.get(`${API_URL}/contracts/devices`, config);
        const devices = devicesRes.data.devices || devicesRes.data.data;
        console.log("Success:", devicesRes.data.success);
        console.log("Device Count:", devices.length);


    } catch (error) {
        console.error("Test Failed:", error.response?.data || error.message);
    }
};

test();
