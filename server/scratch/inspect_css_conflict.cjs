const fs = require('node:fs');
const content = fs.readFileSync('client/src/pages/AdminDashboard.css', 'utf8');
const lines = content.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes('<<<<<<< HEAD'));
const sepIdx = lines.findIndex(l => l.includes('======='));
const endIdx = lines.findIndex(l => l.includes('>>>>>>> feat/fleet-battery-health-ui'));

console.log('Conflict indices in CSS:', { startIdx, sepIdx, endIdx });
console.log('--- HEAD snippet ---');
console.log(lines.slice(startIdx + 1, startIdx + 10).join('\n'));
console.log('--- feat snippet ---');
console.log(lines.slice(sepIdx + 1, sepIdx + 10).join('\n'));

