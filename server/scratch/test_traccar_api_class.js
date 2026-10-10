import TraccarApi from '../adapters/traccar/traccarApi.js';
import { Login, Url } from '../config/config.js';

async function testClass() {
    console.log('Testing TraccarApi class with session management...');
    const api = new TraccarApi({
        host: Url.Traccar,
        user: Login.Traccar.user,
        password: Login.Traccar.password
    });

    try {
        console.log('Sending engineStop command via api.sendCommand...');
        const res = await api.sendCommand({
            id: 0,
            deviceId: 131,
            description: 'New…',
            type: 'engineStop',
            attributes: {},
            textChannel: false
        });
        console.log('\n--- COMMAND SENT SUCCESSFULLY ---');
        console.log(res.data);
    } catch (e) {
        console.error('FAILED:', e.response?.data || e.message);
    }
}

testClass();
