const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

const samples = [];
rl.on('line', (line) => {
  if (line.includes('78780a13') || line.includes('78780b13')) {
    if (samples.length < 20) {
      samples.push(line);
    }
  }
  if (samples.length >= 20) {
    rl.close();
  }
});

rl.on('close', () => {
  console.log('Heartbeat lines (0x13):');
  samples.forEach(s => console.log(s));
});

