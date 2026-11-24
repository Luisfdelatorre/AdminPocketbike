const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Let's find packets starting with 7878 and having protocol 0x13, 0x12, 0x16, 0x94 etc.
const protoCounts = {};

rl.on('line', (line) => {
  const m = line.match(/gt06 < [^\]]+\]\s+([0-9a-f]+)/i);
  if (m) {
    const hex = m[1].toLowerCase();
    if (hex.startsWith('7878') && hex.length >= 8) {
      const proto = hex.slice(6, 8);
      protoCounts['7878_' + proto] = (protoCounts['7878_' + proto] || 0) + 1;
    } else if (hex.startsWith('7979') && hex.length >= 12) {
      const proto = hex.slice(8, 10);
      const sub = hex.slice(10, 12);
      protoCounts['7979_' + proto + '_' + sub] = (protoCounts['7979_' + proto + '_' + sub] || 0) + 1;
    }
  }
});

rl.on('close', () => {
  console.log('GT06 Packet Protocol Distribution:');
  console.log(JSON.stringify(protoCounts, null, 2));
});

