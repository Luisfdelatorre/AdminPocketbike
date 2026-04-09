/**
 * testSession.mjs
 * Run with: node server/adapters/traccar/testSession.mjs
 *
 * Tests Traccar /api/session with different credential combos
 * to find which one the server accepts.
 */

import axios from 'axios';

const HOST     = 'https://pocketbike.app';
const PASSWORD = 'Medalla6571*';

// Try these emails until one works
const EMAILS = [
  'admin',
  'admin@pocketbike.app',
  'admin@pocketbike.co',
  'luis.delatorre0277@gmail.com',
];

async function trySession(email) {
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('password', PASSWORD);

  console.log(`\n→ Trying  email="${email}"  body-len=${params.toString().length}`);
  try {
    const res = await axios.post(`${HOST}/api/session`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });
    console.log(`✅ SUCCESS  status=${res.status}`);
    console.log('   Set-Cookie:', res.headers['set-cookie']);
    console.log('   User:', JSON.stringify(res.data));
    return true;
  } catch (err) {
    const status = err.response?.status ?? 'NO_RESPONSE';
    const body   = err.response?.data   ?? err.message;
    console.log(`❌ FAILED   status=${status}  body=${JSON.stringify(body).slice(0, 120)}`);
    return false;
  }
}

for (const email of EMAILS) {
  const ok = await trySession(email);
  if (ok) {
    console.log(`\n🎉 Working email: "${email}" — update Login.Traccar.email in services.js`);
    break;
  }
}
