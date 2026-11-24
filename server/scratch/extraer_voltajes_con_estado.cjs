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
  console.log('Iniciando extracción enriquecida...');
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

  // Pending voltage packets waiting for IMEI (if voltage came before id line)
  const pendingVoltage = new Map();
  const records = [];

  let totalLines = 0;
  let totalVoltPackets = 0;

  for await (const line of rl) {
    totalLines++;

    // 1. Line with device identity / position
    // e.g. 2026-11-17 00:00:01  INFO: [T31684450] id: 865468052786749, time: 2026-11-16 18:25:45, lat: 10.38982, lon: -75.45656, speed: 3.2, course: 186.0
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
        // Si hay velocidad, evidentemente el switch y motor están encendidos
        if (st.moving) {
          st.acc = true;
        }
      } else {
        st.speedKnots = 0;
        st.speedKmH = 0;
        st.moving = false;
      }

      // Check if thread had a pending voltage packet
      if (pendingVoltage.has(thread)) {
        const p = pendingVoltage.get(thread);
        pendingVoltage.delete(thread);
        records.push({
          imei,
          server_time: p.logTime,
          device_time: st.lastPosTime || p.logTime,
          voltage: p.voltage,
          ignition: st.acc ? 'ENCENDIDA' : 'APAGADA',
          is_moving: st.moving ? 'SI' : 'NO',
          speed_kmh: st.speedKmH,
          lat: st.lat,
          lon: st.lon,
          raw_hex: p.rawHex
        });
      }
      continue;
    }

    // 2. Heartbeat 0x13
    // e.g. 2026-11-17 00:00:00  INFO: [T705dfd74: gt06 < 191.95.17.191] 78780a1346060400010a71ebfc0d0a
    const hbMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78780a13([0-9a-f]{2})/i);
    if (hbMatch) {
      const [, logTime, thread, statusHex] = hbMatch;
      const imei = threadToImei.get(thread);
      if (imei) {
        const st = getState(imei);
        const b = parseInt(statusHex, 16);
        st.acc = (b & 0x02) !== 0; // bit 1: ACC
        st.lastAccTime = logTime;
      }
      continue;
    }

    // 3. Status packet 0x16 (Terminal information byte is at offset 31)
    const statusMatch = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+):\s*gt06\s*<[^\]]+\]\s+78782516[0-9a-f]{48}([0-9a-f]{2})/i);
    if (statusMatch) {
      const [, logTime, thread, statusHex] = statusMatch;
      const imei = threadToImei.get(thread);
      if (imei) {
        const st = getState(imei);
        const b = parseInt(statusHex, 16);
        st.acc = (b & 0x02) !== 0;
        st.lastAccTime = logTime;
      }
      continue;
    }

    // 4. Voltage packet 797900089400
    // e.g. 2026-11-17 00:00:01  INFO: [T31684450: gt06 < 191.95.14.14] 79790008940004ec077866080d0a
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
          ignition: st.acc ? 'ENCENDIDA' : 'APAGADA',
          is_moving: st.moving ? 'SI' : 'NO',
          speed_kmh: st.speedKmH,
          lat: st.lat,
          lon: st.lon,
          raw_hex: '797900089400' + voltHex + rest + '0d0a'
        });
      } else {
        // Guardar para asociarlo con la siguiente línea de id
        pendingVoltage.set(thread, {
          logTime,
          voltage,
          rawHex: '797900089400' + voltHex + rest + '0d0a'
        });
      }
    }
  }

  console.log(`Lectura completada: ${totalLines} líneas procesadas.`);
  console.log(`Tramas de voltaje detectadas: ${totalVoltPackets}`);
  console.log(`Registros de voltaje extraídos y enriquecidos: ${records.length}`);

  // Ordenar cronológicamente
  records.sort((a, b) => a.server_time.localeCompare(b.server_time) || a.imei.localeCompare(b.imei));

  // 1. Guardar CSV completo enriquecido
  const csvPath = path.join(outDir, 'voltajes_detallados_con_estado.csv');
  const headers = ['imei', 'server_time', 'device_time', 'voltage_V', 'ignition', 'is_moving', 'speed_kmh', 'lat', 'lon', 'raw_hex'];
  const csvContent = csv([
    headers,
    ...records.map(r => [
      r.imei,
      r.server_time,
      r.device_time,
      r.voltage,
      r.ignition,
      r.is_moving,
      r.speed_kmh,
      r.lat ?? '',
      r.lon ?? '',
      r.raw_hex
    ])
  ]);
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('Archivo CSV guardado en:', csvPath);

  // 2. Agrupar por IMEI para generar JSON detallado
  const imeiGroups = new Map();
  for (const r of records) {
    if (!imeiGroups.has(r.imei)) {
      imeiGroups.set(r.imei, []);
    }
    imeiGroups.get(r.imei).push({
      time: r.server_time,
      device_time: r.device_time,
      voltage: r.voltage,
      ignition: r.ignition === 'ENCENDIDA',
      moving: r.is_moving === 'SI',
      speed: r.speed_kmh
    });
  }

  const jsonDetailedPath = path.join(outDir, 'secuencias_con_estado_y_velocidad.json');
  fs.writeFileSync(jsonDetailedPath, JSON.stringify(Object.fromEntries(imeiGroups), null, 2), 'utf8');
  console.log('Archivo JSON guardado en:', jsonDetailedPath);

  // 3. Generar estadísticas de ignición y movimiento
  let countEncendida = 0;
  let countMoving = 0;
  for (const r of records) {
    if (r.ignition === 'ENCENDIDA') countEncendida++;
    if (r.is_moving === 'SI') countMoving++;
  }

  console.log('\n--- RESUMEN ESTADÍSTICO DE LECTURAS ---');
  console.log(`Total lecturas de voltaje: ${records.length}`);
  console.log(`Lecturas con vehículo ENCENDIDO: ${countEncendida} (${((countEncendida / records.length) * 100).toFixed(1)}%)`);
  console.log(`Lecturas con vehículo en MOVIMIENTO: ${countMoving} (${((countMoving / records.length) * 100).toFixed(1)}%)`);
  console.log(`Vehículos únicos analizados: ${imeiGroups.size}`);

  // Muestra de un vehículo para validar
  const firstImei = records.find(r => r.ignition === 'ENCENDIDA' && r.is_moving === 'SI')?.imei || records[0].imei;
  console.log(`\nEjemplo de lecturas para IMEI ${firstImei}:`);
  console.log(records.filter(r => r.imei === firstImei).slice(0, 5));
}

run().catch(err => {
  console.error('Error al ejecutar:', err);
  process.exit(1);
});

