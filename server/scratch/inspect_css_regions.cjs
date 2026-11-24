const fs = require('node:fs');
const content = fs.readFileSync('client/src/pages/AdminDashboard.css', 'utf8');
const lines = content.split(/\r?\n/);
console.log('--- Lines 255 to 270 ---');
console.log(lines.slice(255, 270).join('\n'));
console.log('--- Lines 415 to 430 ---');
console.log(lines.slice(415, 430).join('\n'));

