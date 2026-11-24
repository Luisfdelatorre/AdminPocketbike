const fs = require('node:fs');
const readline = require('node:readline');

const rl = readline.createInterface({
  input: fs.createReadStream('server/tracker-server.log', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

// Let's test checking correlation between:
// 1) 0x13 / 0x16 terminal info byte (ACC bit)
// 2) 0x12 position speed
// We track per IMEI:
// lastKnownAcc, lastKnownSpeed, lastKnownSpeedKmH, lastKnownLat, lastKnownLon, lastPosTime
const imeiState = new Map();
const threadToImei = new Map();

let sampleRows = [];

function getOrCreate(imei) {
  if (!imeiState.has(imei)) {
    imeiState.set(imei, {
      acc: false,
      speedKnots: 0,
      speedKmH: 0,
      moving: false,
      lastPosTime: null,
      lastAccTime: null
    });
  }
  return imeiState.get(imei);
}

rl.on('line', (line) => {
  // Check thread IMEI mapping
  const idMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+)\]\s+id:\s*(\d+)(?:,\s*time:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d))?(?:.*speed:\s*([\d.]+))?/i);
  if (idMatch) {
    const [, logTime, thread, imei, deviceTime, spdStr] = idMatch;
    threadToImei.set(thread, imei);
    const st = getOrCreate(imei);
    if (deviceTime) st.lastPosTime = deviceTime;
    if (spdStr) {
      const knots = parseFloat(spdStr);
      st.speedKnots = knots;
      st.speedKmH = +(knots * 1.852).toFixed(1);
      st.moving = st.speedKmH >= 3.0;
    } else {
      st.speedKnots = 0;
      st.speedKmH = 0;
      st.moving = false;
    }
  }

  // Check 0x13 Heartbeat
  const hbMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78780a13([0-9a-f]{2})/i);
  if (hbMatch) {
    const [, logTime, thread, statusHex] = hbMatch;
    const imei = threadToImei.get(thread);
    if (imei) {
      const st = getOrCreate(imei);
      const b = parseInt(statusHex, 16);
      st.acc = (b & 0x02) !== 0;
      st.lastAccTime = logTime;
    }
  }

  // Check 0x16 Status with GPS
  const statusGpsMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78782516[0-9a-f]{48}([0-9a-f]{2})/i);
  if (statusGpsMatch) {
    const [, logTime, thread, statusHex] = statusGpsMatch;
    const imei = threadToImei.get(thread);
    if (imei) {
      const st = getOrCreate(imei);
      const b = parseInt(statusHex, 16);
      st.acc = (b & 0x02) !== 0;
      st.lastAccTime = logTime;
    }
  }

  // Check Voltage packet 797900089400
  const vMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+797900089400([0-9a-f]{4})/i);
  if (vMatch) {
    const [, logTime, thread, rawHex] = vMatch;
    const imei = threadToImei.get(thread);
    const raw = parseInt(rawHex, 16);
    const voltage = +(raw / 100).toFixed(2);
    if (imei && sampleRows.length < 25) {
      const st = getOrCreate(imei);
      sampleRows.push({
        imei,
        serverTime: logTime,
        deviceTime: st.lastPosTime || logTime,
        voltage,
        accOn: st.acc,
        speedKmH: st.speedKmH,
        moving: st.moving
      });
    }
  }
});

rl.on('close', () => {
  console.log('Sample enriched voltage records:');
  console.log(JSON.stringify(sampleRows, null, 2));
});

