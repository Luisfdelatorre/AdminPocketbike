const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

const samples = [];
rl.on('line', (line) => {
  if (line.includes('speed:') || line.includes('lat:')) {
    if (samples.length < 25) {
      samples.push(line);
    }
  }
  if (samples.length >= 25) {
    rl.close();
  }
});

rl.on('close', () => {
  console.log('Position decoded lines:');
  samples.forEach(s => console.log(s));
});

