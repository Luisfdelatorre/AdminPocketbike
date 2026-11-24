const fs = require('node:fs');
const content = fs.readFileSync('client/src/pages/AdminDashboard.jsx', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(180, 225).map((l, i) => `${i + 181}: ${l}`).join('\n'));

