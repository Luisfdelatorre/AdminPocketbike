import axios from 'axios';
import { Login, Url } from '../config/config.js';

async function diagnose() {
  const host = Url.Traccar.startsWith('http') ? Url.Traccar : 'https://' + Url.Traccar;
  const authHeader = 'Basic ' + Buffer.from(`${Login.Traccar.user}:${Login.Traccar.password}`).toString('base64');

  const sessionRes = await axios.post(`${host}/api/session`, 
    new URLSearchParams({ email: Login.Traccar.user, password: Login.Traccar.password }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const cookie = sessionRes.headers['set-cookie']?.[0]?.split(';')?.[0];
  console.log('Cookie obtained:', cookie ? 'YES' : 'NO');

  // Check device 38
  const devRes = await axios.get(`${host}/api/devices?id=38`, {
    headers: { Authorization: authHeader, Cookie: cookie }
  });
  console.log('Device 38:', devRes.data);

  // Check server commands config if visible
  try {
    const serverRes = await axios.get(`${host}/api/server`, {
      headers: { Authorization: authHeader, Cookie: cookie }
    });
    console.log('Server attributes:', serverRes.data?.attributes);
  } catch (e) {
    console.log('Server info error:', e.message);
  }
}

diagnose().catch(console.error);
