import axios from 'axios';

const API_URL = 'http://127.0.0.1:3000/apinode'; // Port from config/core.js and .env

const test = async () => {
    try {
        // 1. Login
        console.log("Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@pocketbike.app',
            password: 'Admin123!'
        });
        console.log("Login Response Data:", JSON.stringify(loginRes.data, null, 2));
        const token = loginRes.data.data?.token || loginRes.data.token;
        console.log("Logged in. Token:", token ? "Yes" : "No");

        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // 2. Get Companies
        console.log("Fetching companies...");
        const companiesRes = await axios.get(`${API_URL}/companies`, config);
        const companies = companiesRes.data.data;
        console.log(`Found ${companies.length} companies.`);

        let testCompany;
        if (companies.length > 0) {
            testCompany = companies[0];
            console.log("Using existing company:", testCompany.name);
        } else {
            console.log("Creating test company...");
            const createRes = await axios.post(`${API_URL}/companies`, {
                name: "Test Company Update",
                email: "test@update.com"
            }, config);
            testCompany = createRes.data.data;
            console.log("Created company:", testCompany.name);
        }

        // 3. Update Company
        const originalName = testCompany.name;
        const newName = `${originalName} Updated`;
        console.log(`Updating company ${testCompany._id} name to: ${newName}`);

        const updateRes = await axios.put(`${API_URL}/companies/${testCompany._id}`, {
            name: newName,
            email: testCompany.email // Keep email same
        }, config);

        if (updateRes.data.success && updateRes.data.data.name === newName) {
            console.log("Update SUCCESS!");
        } else {
            console.error("Update FAILED!", updateRes.data);
        }

        // 4. Revert
        console.log("Reverting changes...");
        await axios.put(`${API_URL}/companies/${testCompany._id}`, {
            name: originalName,
            email: testCompany.email
        }, config);
        console.log("Reverted.");

    } catch (error) {
        console.error("Test Failed:", error.response?.data || error.message);
    }
};

test();
