import axios from 'axios';
import { Login, Url } from '../config/config.js';

async function testCmd() {
    const host = Url.Traccar;
    const baseURL = host.startsWith('http') ? host : `https://${host}`;

    try {
        // 1. Session via POST
        const params = new URLSearchParams();
        params.append('email', Login.Traccar.user);
        params.append('password', Login.Traccar.password);

        const sessionRes = await axios.post(`${baseURL}/api/session`, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const cookie = sessionRes.headers['set-cookie']?.[0];
        console.log('Session created. Cookie:', cookie);

        const authHeader = 'Basic ' + Buffer.from(`${Login.Traccar.user}:${Login.Traccar.password}`).toString('base64');

        // Test 1: Send command with Basic Auth ONLY (how traccarApi.js currently does it)
        console.log('\n--- TEST 1: Sending command with Basic Auth only ---');
        try {
            const res1 = await axios.post(`${baseURL}/api/commands/send`, {
                id: 0,
                deviceId: 131,
                description: 'New…',
                type: 'engineStop',
                attributes: {},
                textChannel: false
            }, {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Test 1 SUCCESS:', res1.data);
        } catch (e) {
            console.error('Test 1 FAILED:');
            console.error('Status:', e.response?.status);
            console.error('Data:', e.response?.data);
        }

        // Test 2: Send command with Cookie (and optional Basic Auth)
        console.log('\n--- TEST 2: Sending command with Cookie ---');
        try {
            const res2 = await axios.post(`${baseURL}/api/commands/send`, {
                id: 0,
                deviceId: 131,
                description: 'New…',
                type: 'engineStop',
                attributes: {},
                textChannel: false
            }, {
                headers: {
                    Cookie: cookie,
                    Authorization: authHeader,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Test 2 SUCCESS:', res2.data);
        } catch (e) {
            console.error('Test 2 FAILED:');
            console.error('Status:', e.response?.status);
            console.error('Data:', e.response?.data);
        }

    } catch (e) {
        console.error(e);
    }
}

testCmd();
