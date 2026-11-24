const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

const targetImei = '865468052755249';
let targetThreads = new Set();
let positions = [];

rl.on('line', (line) => {
  const idMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+)\]\s+id:\s*(\d+)/i);
  if (idMatch && idMatch[3] === targetImei) {
    targetThreads.add(idMatch[2]);
  }

  // Check 0x12 location packet
  if (line.includes('78781f12')) {
    const m = line.match(/\[(T[0-9a-f]+):/i);
    if (m && targetThreads.has(m[1])) {
      positions.push({ type: '0x12', line });
    }
  }

  // Check 0x16 status packet
  if (line.includes('78782516')) {
    const m = line.match(/\[(T[0-9a-f]+):/i);
    if (m && targetThreads.has(m[1])) {
      positions.push({ type: '0x16', line });
    }
  }
});

rl.on('close', () => {
  console.log(`Total 0x12 / 0x16 position packets for ${targetImei}: ${positions.length}`);
});

