const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Let's examine:
// 1) 0x13 heartbeat
// 2) 0x12 location
// 3) 0x16 alarm/status
// 4) 0x94 0x0a vs 0x94 0x00
// And see what Traccar logs right after them!

let pending = null;
let examples = [];

rl.on('line', (line) => {
  if (pending) {
    if (line.includes(`[${pending.thread}]`)) {
      examples.push({
        pkt: pending.hex,
        desc: pending.desc,
        decoded: line
      });
      pending = null;
      if (examples.length >= 15) {
        rl.close();
      }
    }
  }

  const m = line.match(/INFO: \[([T0-9a-f]+): gt06 < [^\]]+\]\s+([0-9a-f]+)/i);
  if (m) {
    const thread = m[1];
    const hex = m[2].toLowerCase();
    if (hex.startsWith('78780a13') && examples.length < 3) {
      pending = { thread, hex, desc: '0x13 Heartbeat' };
    } else if (hex.startsWith('78781f12') && examples.length < 8) {
      pending = { thread, hex, desc: '0x12 Location' };
    } else if (hex.startsWith('7878') && hex.slice(6, 8) === '16' && examples.length < 12) {
      pending = { thread, hex, desc: '0x16 Status/Alarm' };
    }
  }
});

rl.on('close', () => {
  console.log(JSON.stringify(examples, null, 2));
});

