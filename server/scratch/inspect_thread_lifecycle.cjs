const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Let's examine lines around voltage packets for one thread
let linesCollected = [];
let targetThread = null;

rl.on('line', (line) => {
  if (!targetThread && line.includes('797900089400')) {
    const m = line.match(/\[(T[0-9a-f]+):/i);
    if (m) {
      targetThread = m[1];
      linesCollected.push(line);
      return;
    }
  }

  if (targetThread && line.includes(`[${targetThread}`)) {
    linesCollected.push(line);
    if (linesCollected.length >= 10) {
      rl.close();
    }
  }
});

rl.on('close', () => {
  console.log(`Trace for thread ${targetThread}:`);
  linesCollected.forEach(l => console.log(l));
});

