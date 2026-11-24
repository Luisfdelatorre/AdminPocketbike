const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

let lines = 0;
let firstLine = '';
let lastLine = '';

rl.on('line', (line) => {
  lines++;
  if (!firstLine) firstLine = line;
  lastLine = line;
});

rl.on('close', () => {
  console.log(`Total lines in tracker-server.log: ${lines}`);
  console.log('First line:', firstLine);
  console.log('Last line:', lastLine);
});

