'use strict';

const fs = require('node:fs');
const readline = require('node:readline');
const path = require('node:path');

const logFile = path.resolve('server/tracker-server.log');
const outDir = path.resolve('server/scratch/reporte-voltajes');

if (!fs.existsSync(logFile)) {
  console.error('No se encontró el log en:', logFile);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function csv(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n';
}

async function run() {
  console.log('Iniciando extracción con flag charging (alimentación externa)...');
  const rl = readline.createInterface({
    input: fs.createReadStream(logFile, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  const threadToImei = new Map();
  const imeiState = new Map();

  function getState(imei) {
    if (!imeiState.has(imei)) {
      imeiState.set(imei, {
        acc: false,
        charging: true, // Bit 2 (alimentación externa conectada)
        speedKnots: 0,
        speedKmH: 0,
        moving: false,
        lat: null,
        lon: null,
        lastPosTime: null,
        lastAccTime: null
      });
    }
    return imeiState.get(imei);
  }

  const pendingVoltage = new Map();
  const records = [];

  let totalLines = 0;
  let totalVoltPackets = 0;

  for await (const line of rl) {
    totalLines++;

    // 1. Identificación y posición
    const idMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+)\]\s+id:\s*(\d+)(?:,\s*time:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d))?(?:,\s*lat:\s*([-\d.]+))?(?:,\s*lon:\s*([-\d.]+))?(?:.*speed:\s*([\d.]+))?/i);
    if (idMatch) {
      const [, logTime, thread, imei, deviceTime, latStr, lonStr, spdStr] = idMatch;
      threadToImei.set(thread, imei);
      const st = getState(imei);

      if (deviceTime) st.lastPosTime = deviceTime;
      if (latStr) st.lat = parseFloat(latStr);
      if (lonStr) st.lon = parseFloat(lonStr);

      if (spdStr) {
        const knots = parseFloat(spdStr);
        st.speedKnots = knots;
        st.speedKmH = +(knots * 1.852).toFixed(1);
        st.moving = st.speedKmH >= 3.0;
        if (st.moving) {
          st.acc = true;
        }
      } else {
        st.speedKnots = 0;
        st.speedKmH = 0;
        st.moving = false;
      }

      // Si había trama de voltaje pendiente de asociar
      if (pendingVoltage.has(thread)) {
        const p = pendingVoltage.get(thread);
        pendingVoltage.delete(thread);
        records.push({
          imei,
          server_time: p.logTime,
          device_time: st.lastPosTime || p.logTime,
          voltage: p.voltage,
          ignition: st.acc,
          charging: st.charging, // Flag alimentación externa
          is_moving: st.moving,
          speed_kmh: st.speedKmH,
          lat: st.lat,
          lon: st.lon,
          raw_hex: p.rawHex
        });
      }
      continue;
    }

    // 2. Heartbeat 0x13
    // Formato: 78 78 0a 13 [statusHex: 1 byte] ...
    const hbMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78780a13([0-9a-f]{2})/i);
    if (hbMatch) {
      const [, logTime, thread, statusHex] = hbMatch;
      const imei = threadToImei.get(thread);
      if (imei) {
        const st = getState(imei);
        const b = parseInt(statusHex, 16);
        st.acc = (b & 0x02) !== 0;       // Bit 1: ACC / switch
        st.charging = (b & 0x04) !== 0;  // Bit 2: Charging / alimentación externa conectada
        st.lastAccTime = logTime;
      }
      continue;
    }

    // 3. Status packet 0x16 (Terminal info byte at offset 31)
    const statusMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78782516[0-9a-f]{48}([0-9a-f]{2})/i);
    if (statusMatch) {
      const [, logTime, thread, statusHex] = statusMatch;
      const imei = threadToImei.get(thread);
      if (imei) {
        const st = getState(imei);
        const b = parseInt(statusHex, 16);
        st.acc = (b & 0x02) !== 0;       // Bit 1: ACC
        st.charging = (b & 0x04) !== 0;  // Bit 2: Charging
        st.lastAccTime = logTime;
      }
      continue;
    }

    // 4. Voltage packet 797900089400
    const vMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+797900089400([0-9a-f]{4})([0-9a-f]+)0d0a$/i);
    if (vMatch) {
      totalVoltPackets++;
      const [, logTime, thread, voltHex, rest] = vMatch;
      const raw = parseInt(voltHex, 16);
      const voltage = +(raw / 100).toFixed(2);
      const imei = threadToImei.get(thread);

      if (imei) {
        const st = getState(imei);
        records.push({
          imei,
          server_time: logTime,
          device_time: st.lastPosTime || logTime,
          voltage,
          ignition: st.acc,
          charging: st.charging, // Flag alimentación externa
          is_moving: st.moving,
          speed_kmh: st.speedKmH,
          lat: st.lat,
          lon: st.lon,
          raw_hex: '797900089400' + voltHex + rest + '0d0a'
        });
      } else {
        pendingVoltage.set(thread, {
          logTime,
          voltage,
          rawHex: '797900089400' + voltHex + rest + '0d0a'
        });
      }
    }
  }

  console.log(`Líneas leídas: ${totalLines}`);
  console.log(`Tramas de voltaje procesadas: ${records.length}`);

  records.sort((a, b) => a.server_time.localeCompare(b.server_time) || a.imei.localeCompare(b.imei));

  // Agrupar por IMEI para generar secuencias_con_estado_y_velocidad.json
  const imeiGroups = new Map();
  for (const r of records) {
    if (!imeiGroups.has(r.imei)) {
      imeiGroups.set(r.imei, []);
    }
    imeiGroups.get(r.imei).push({
      time: r.server_time,
      device_time: r.device_time,
      voltage: r.voltage,
      ignition: r.ignition,
      charging: r.charging, // Flag agregada
      moving: r.is_moving,
      speed: r.speed_kmh
    });
  }

  const jsonDetailedPath = path.join(outDir, 'secuencias_con_estado_y_velocidad.json');
  fs.writeFileSync(jsonDetailedPath, JSON.stringify(Object.fromEntries(imeiGroups), null, 2), 'utf8');
  console.log('Archivo JSON actualizado en:', jsonDetailedPath);

  // Actualizar CSV detallado
  const csvPath = path.join(outDir, 'voltajes_detallados_con_estado.csv');
  const headers = ['imei', 'server_time', 'device_time', 'voltage_V', 'ignition', 'charging', 'is_moving', 'speed_kmh', 'lat', 'lon', 'raw_hex'];
  const csvContent = csv([
    headers,
    ...records.map(r => [
      r.imei,
      r.server_time,
      r.device_time,
      r.voltage,
      r.ignition ? 'ENCENDIDA' : 'APAGADA',
      r.charging ? 'SI' : 'NO',
      r.is_moving ? 'SI' : 'NO',
      r.speed_kmh,
      r.lat ?? '',
      r.lon ?? '',
      r.raw_hex
    ])
  ]);
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('Archivo CSV actualizado en:', csvPath);

  // Estadísticas del flag charging
  let chargingYes = 0;
  let chargingNo = 0;
  for (const r of records) {
    if (r.charging) chargingYes++;
    else chargingNo++;
  }
  console.log(`\nEstadísticas Flag Charging:`);
  console.log(`- Charging = TRUE (Alimentación externa activa): ${chargingYes} (${((chargingYes / records.length) * 100).toFixed(1)}%)`);
  console.log(`- Charging = FALSE (Sin alimentación externa): ${chargingNo} (${((chargingNo / records.length) * 100).toFixed(1)}%)`);

  // Mostrar muestra de DRS36I (865468052755249)
  const drsSamples = imeiGroups.get('865468052755249');
  if (drsSamples) {
    console.log(`\nMuestra para DRS36I (865468052755249):`);
    console.log(drsSamples.slice(-5));
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

