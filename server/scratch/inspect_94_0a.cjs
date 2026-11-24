const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Let's see some samples of 79790020940a...
const samples = [];
rl.on('line', (line) => {
  if (line.includes('79790020940a')) {
    samples.push(line);
    if (samples.length >= 5) {
      rl.close();
    }
  }
});

rl.on('close', () => {
  console.log('7979 0x94 0x0a packets:');
  samples.forEach(s => console.log(s));
});

