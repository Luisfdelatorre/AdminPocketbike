import axios from 'axios';

const API_URL = 'http://127.0.0.1:3000/apinode';

const test = async () => {
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@pocketbike.app',
            password: 'Admin123!'
        });

        const token = loginRes.data.data?.token || loginRes.data.token;
        console.log("Logged in:", !!token);

        console.log("Fetching devices...");
        const devicesRes = await axios.get(`${API_URL}/devices`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Success:", devicesRes.data.success);
        console.log("Device Count:", devicesRes.data.devices.length);
        if (devicesRes.data.devices.length > 0) {
            console.log("Sample Device Company:", devicesRes.data.devices[0].companyId, devicesRes.data.devices[0].companyName);
        }

    } catch (error) {
        console.error("Test Failed:", error.response?.data || error.message);
    }
};

test();
