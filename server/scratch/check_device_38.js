import axios from 'axios';
import { Login, Url } from '../config/config.js';

async function check() {
  const host = Url.Traccar.startsWith('http') ? Url.Traccar : 'https://' + Url.Traccar;
  const authHeader = 'Basic ' + Buffer.from(`${Login.Traccar.user}:${Login.Traccar.password}`).toString('base64');
  
  const params = new URLSearchParams();
  params.append('email', Login.Traccar.user);
  params.append('password', Login.Traccar.password);
  const sRes = await axios.post(`${host}/api/session`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const cookie = sRes.headers['set-cookie']?.[0]?.split(';')?.[0];

  console.log('Sending command to device 50 (disabled offline device)...');
  const t0 = Date.now();
  try {
    const res = await axios.post(`${host}/api/commands/send`, {
      id: 0,
      deviceId: 50,
      description: 'New…',
      type: 'engineStop',
      attributes: {},
      textChannel: false
    }, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    console.log('SUCCESS in', Date.now() - t0, 'ms:', res.status, res.data);
  } catch (e) {
    console.log('ERROR in', Date.now() - t0, 'ms:', e.message, e.response?.status, e.response?.data);
  }
}

check().catch(console.error);
