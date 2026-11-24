const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// We want to track IMEI 865468052755249 across the entire new log
const targetImei = '865468052755249';
let targetThreads = new Set();
let matchedLines = [];

rl.on('line', (line) => {
  // Check if line mentions the IMEI
  if (line.includes(targetImei)) {
    matchedLines.push(line);
    const m = line.match(/\[(T[0-9a-f]+)\]/i);
    if (m) targetThreads.add(m[1]);
  } else {
    // Check if line belongs to one of the target threads
    for (const t of targetThreads) {
      if (line.includes(`[${t}:`)) {
        matchedLines.push(line);
        break;
      }
    }
  }
});

rl.on('close', () => {
  console.log(`Total matched lines for ${targetImei}: ${matchedLines.length}`);
  console.log('First 5 lines:');
  matchedLines.slice(0, 5).forEach(l => console.log(l));
  console.log('Last 10 lines:');
  matchedLines.slice(-10).forEach(l => console.log(l));
});

