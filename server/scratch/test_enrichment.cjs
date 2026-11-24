const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// We want to see how Traccar associates threads to IMEIs
// Thread map: thread -> imei
const threadToImei = new Map();
const imeiToLastState = new Map();

// Let's count how many voltage records we can enrich with:
// - exact time of log
// - device timestamp (if available in decoded line or packet)
// - speed (knots / km/h)
// - is_moving (speed > 1.0 or 2.0 km/h)
// - is_ignition_on (from status/heartbeat ACC bit or speed > 0)
// - voltage
let voltageCount = 0;
let enrichedCount = 0;

rl.on('line', (line) => {
  // Check thread IMEI mapping
  // e.g. 2026-11-17 00:00:00  INFO: [T705dfd74] id: 866557081709497, time: 2026-11-16 23:59:58, lat: 10.37129, lon: -75.49825, course: 78.0
  const idMatch = line.match(/\[(T[0-9a-f]+)\]\s+id:\s*(\d+)/i);
  if (idMatch) {
    const thread = idMatch[1];
    const imei = idMatch[2];
    threadToImei.set(thread, imei);

    // Also extract speed if present
    const spdMatch = line.match(/speed:\s*([\d.]+)/i);
    const speed = spdMatch ? parseFloat(spdMatch[1]) : 0;
    
    // Extract device time
    const timeMatch = line.match(/time:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/i);
    const deviceTime = timeMatch ? timeMatch[1] : null;

    if (!imeiToLastState.has(imei)) {
      imeiToLastState.set(imei, { speed: 0, deviceTime: null, ignition: false, lastSeen: null });
    }
    const state = imeiToLastState.get(imei);
    state.speed = speed;
    if (deviceTime) state.deviceTime = deviceTime;
  }

  // Check 0x13 or 0x16 for ACC bit
  // e.g. [T705dfd74: gt06 < ...] 78780a134606...
  const hbMatch = line.match(/\[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+(78780a13([0-9a-f]{2})[0-9a-f]+)/i);
  if (hbMatch) {
    const thread = hbMatch[1];
    const termInfoHex = hbMatch[3];
    const termInfo = parseInt(termInfoHex, 16);
    const acc = (termInfo & 0x02) !== 0; // bit 1
    const imei = threadToImei.get(thread);
    if (imei && imeiToLastState.has(imei)) {
      imeiToLastState.get(imei).ignition = acc;
    }
  }

  // Check voltage 797900089400
  if (line.includes('797900089400')) {
    voltageCount++;
  }
});

rl.on('close', () => {
  console.log(`Finished test scan. Total voltages: ${voltageCount}, Devices tracked: ${imeiToLastState.size}`);
});

