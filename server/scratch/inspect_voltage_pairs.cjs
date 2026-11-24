const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// We want to see pairs of [pkt (hex)] followed by decoded id line for 797900089400
let lookForId = null;
let found = 0;

rl.on('line', (line) => {
  if (lookForId) {
    if (line.includes(`[${lookForId.thread}]`)) {
      console.log('Voltage pkt:', lookForId.line);
      console.log('Decoded info:', line);
      console.log('---');
      lookForId = null;
      found++;
      if (found >= 5) {
        rl.close();
      }
    }
  }

  if (line.includes('797900089400')) {
    const m = line.match(/\[(T[0-9a-f]+):/i);
    if (m) {
      lookForId = { thread: m[1], line };
    }
  }
});

