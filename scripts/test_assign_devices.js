import axios from 'axios';

const API_URL = 'http://127.0.0.1:3000/apinode';

const test = async () => {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@pocketbike.app',
            password: 'Admin123!'
        });
        const token = loginRes.data.data?.token || loginRes.data.token;
        console.log("Logged in:", !!token);

        const config = { headers: { Authorization: `Bearer ${token}` } };

        // 1. Get Companies
        const companiesRes = await axios.get(`${API_URL}/companies`, config);
        const companies = companiesRes.data.data;
        if (companies.length < 1) throw new Error("Need at least 1 company");

        const company = companies[0];
        console.log("Target Company:", company.name, company._id);

        // 2. Get Devices
        const devicesRes = await axios.get(`${API_URL}/devices`, config);
        const devices = devicesRes.data.devices || devicesRes.data.data;
        if (devices.length < 1) throw new Error("Need at least 1 device");

        const deviceToAssign = devices[0];
        console.log("Target Device:", deviceToAssign.name, deviceToAssign._id, typeof deviceToAssign._id);
        console.log("Current Company:", deviceToAssign.companyName);

        // DEBUG: Check with POST
        try {
            const debugRes = await axios.post(`${API_URL}/devices/debug-device-check`, {
                id: deviceToAssign._id
            }, config);
            console.log("Debug POST Result:", JSON.stringify(debugRes.data, null, 2));
        } catch (e) {
            console.log("Debug POST Failed:", e.message);
        }

        // 3. Assign Device to Company
        console.log("Assigning device...");
        const assignRes = await axios.post(`${API_URL}/devices/assign-to-company`, {
            companyId: company._id,
            deviceIds: [String(deviceToAssign._id)] // Ensure string
        }, config);

        console.log("Assign Result:", assignRes.data);

        // 4. Verify
        const verifyRes = await axios.get(`${API_URL}/devices`, config);
        const updatedDevices = verifyRes.data.devices || verifyRes.data.data;
        const updatedDevice = updatedDevices.find(d => d._id === deviceToAssign._id);

        console.log("Updated Company:", updatedDevice.companyName);
        console.log("Match:", updatedDevice.companyId === company._id);

    } catch (error) {
        console.error("Test Failed:", error.response?.data || error.message);
    }
};

test();
