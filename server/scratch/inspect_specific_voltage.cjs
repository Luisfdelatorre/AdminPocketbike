const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

const targetImei = '865468052755249';
let targetThreads = new Set();
let readings = [];

let pendingVolt = null;

rl.on('line', (line) => {
  // Check thread IMEI mapping
  const idMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+)\]\s+id:\s*(\d+)/i);
  if (idMatch) {
    const [, logTime, thread, imei] = idMatch;
    if (imei === targetImei) {
      targetThreads.add(thread);
    }
  }

  // Check 0x13 Heartbeat
  const hbMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78780a13([0-9a-f]{2})/i);
  if (hbMatch) {
    const [, logTime, thread, statusHex] = hbMatch;
    if (targetThreads.has(thread)) {
      const b = parseInt(statusHex, 16);
      const acc = (b & 0x02) !== 0;
      readings.push({
        type: 'HEARTBEAT_0x13',
        time: logTime,
        acc,
        statusHex,
        line
      });
    }
  }

  // Check 0x94 0x00 external voltage
  const vMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+797900089400([0-9a-f]{4})/i);
  if (vMatch) {
    const [, logTime, thread, rawHex] = vMatch;
    if (targetThreads.has(thread)) {
      const raw = parseInt(rawHex, 16);
      const voltage = +(raw / 100).toFixed(2);
      readings.push({
        type: 'VOLTAGE_0x94_00',
        time: logTime,
        voltage,
        rawHex,
        line
      });
    }
  }

  // Check 0x94 0x0a status packet
  const v10Match = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+79790020940a/i);
  if (v10Match) {
    const [, logTime, thread] = v10Match;
    if (targetThreads.has(thread)) {
      readings.push({
        type: 'STATUS_0x94_0a',
        time: logTime,
        line
      });
    }
  }
});

rl.on('close', () => {
  console.log(`Finished. Found ${readings.length} telemetry events for ${targetImei} today (2026-11-18):`);
  const voltages = readings.filter(r => r.type === 'VOLTAGE_0x94_00');
  console.log(`Voltage packets found: ${voltages.length}`);
  voltages.forEach(v => {
    console.log(`[${v.time}] Voltaje: ${v.voltage}V (raw: ${v.rawHex})`);
  });
  if (voltages.length === 0) {
    console.log('No 0x94 0x00 voltage packets! Showing last 15 general events:');
    readings.slice(-15).forEach(r => console.log(r.time, r.type, r.acc !== undefined ? 'ACC:' + r.acc : ''));
  }
});

