const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

const targetImei = '865468052755249';
let targetThreads = new Set();
let heartbeats = [];

rl.on('line', (line) => {
  const idMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+)\]\s+id:\s*(\d+)/i);
  if (idMatch && idMatch[3] === targetImei) {
    targetThreads.add(idMatch[2]);
  }

  const hbMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78780a13([0-9a-f]{2})([0-9a-f]{2})/i);
  if (hbMatch && targetThreads.has(hbMatch[2])) {
    const [, time, thread, termInfoHex, gsmLevelHex] = hbMatch;
    const termInfo = parseInt(termInfoHex, 16);
    // GT06 heartbeat format:
    // 78 78 0a 13 [terminal_info: 1 byte] [voltage_level: 1 byte] [gsm_level: 1 byte]
    heartbeats.push({
      time,
      termInfoHex,
      termInfoBin: termInfo.toString(2).padStart(8, '0'),
      acc: (termInfo & 0x02) !== 0,
      charging: (termInfo & 0x04) !== 0,
      oilElec: (termInfo & 0x80) !== 0,
      gpsTracking: (termInfo & 0x40) !== 0,
      defense: (termInfo & 0x01) !== 0,
      voltageLevelHex: gsmLevelHex
    });
  }
});

rl.on('close', () => {
  console.log(`Heartbeat samples for ${targetImei} (Total: ${heartbeats.length}):`);
  console.log('Unique terminal info flags:');
  const uniqueFlags = [...new Set(heartbeats.map(h => h.termInfoHex))];
  console.log(uniqueFlags);
  console.log('Sample heartbeat breakdown:');
  heartbeats.slice(-5).forEach(h => console.log(h));
});

