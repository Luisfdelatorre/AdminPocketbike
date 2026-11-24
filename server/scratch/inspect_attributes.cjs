const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Check if any line has attributes or ignition in decoded text
const hits = [];

rl.on('line', (line) => {
  if (line.includes('ignition:') || line.includes('attributes:') || line.includes('power:')) {
    hits.push(line);
    if (hits.length >= 10) {
      rl.close();
    }
  }
});

rl.on('close', () => {
  console.log('Hits with ignition / attributes / power:');
  console.log(hits);
});

