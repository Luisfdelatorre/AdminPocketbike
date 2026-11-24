const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Target imei: 865468052786749
let imeiFound = false;
let records = [];

rl.on('line', (line) => {
  if (line.includes('865468052786749')) {
    records.push(line);
    if (records.length >= 20) {
      rl.close();
    }
  }
});

rl.on('close', () => {
  console.log('Sample for 865468052786749:');
  records.forEach(r => console.log(r));
});

