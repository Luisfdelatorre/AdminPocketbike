const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

const samples = [];
let count = 0;

rl.on('line', (line) => {
  count++;
  if (line.includes('gt06') || line.includes('id:')) {
    if (samples.length < 40) {
      samples.push(line);
    }
  }
  if (samples.length >= 40) {
    rl.close();
  }
});

rl.on('close', () => {
  console.log('Sampled lines:');
  samples.forEach(s => console.log(s));
});

