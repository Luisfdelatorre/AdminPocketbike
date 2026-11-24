'use strict';

const fs = require('node:fs');
const path = require('node:path');

// =====================================================================
// ALGORITMO INCREMENTAL O(1) (Usuario + extensión charging/corte)
// =====================================================================

const C = {
  openV: 9.0,          // reposo < esto: abierta / sin celdas
  damagedV: 11.8,      // reposo < esto: dañada
  healthyV: 12.2,      // reposo >= esto: sana
  stopWeakV: 12.3,     // voltaje tras apagar (después de cargar) < esto: débil
  band: 0.1,           // banda Schmitt
  settleMin: 180,      // minutos sin ignición para "reposo asentado"
  tauMin: 60,          // constante de tiempo del EWMA de reposo
  stopMaxGapMin: 25,   // el apagado debe verse <= 25 min después de la última lectura cargando
  chargedV: 13.2,      // lectura previa >= esto = estaba cargando
  runKmh: 10,          // km/h para contar como "motor en marcha"
  proofV: 14.0,        // lectura >= esto con ignición ON = el alternador SÍ carga
  proofTtlH: 72,       // vigencia de esa prueba
  chargeFailV: 13.5,   // media en marcha < esto (sin prueba) => no carga
  minRun: 5,           // muestras en marcha para declarar "no carga"
  confirmWorse: 2,
  confirmBetter: 3,
};

const RANK = { HEALTHY: 0, WEAK: 1, DAMAGED: 2 };

const SL = {
  tauH: 6,
  gapMin: 45,
  minN: 8,
  minSpanH: 6,
  slopeVph: -0.03,
  minDropV: 0.25,
  minR2: 0.6,
};

const newSlope = () => ({ t0: null, last: 0, n: 0, S0: 0, Sx: 0, Sy: 0, Sxx: 0, Sxy: 0, Syy: 0 });

function slopeAdd(q, t, v) {
  if (q.t0 === null || t - q.last > SL.gapMin * 60000) Object.assign(q, newSlope(), { t0: t });
  else {
    const k = Math.exp(-((t - q.last) / 3.6e6) / SL.tauH);
    q.S0 *= k; q.Sx *= k; q.Sy *= k; q.Sxx *= k; q.Sxy *= k; q.Syy *= k;
  }
  const x = (t - q.t0) / 3.6e6;
  q.S0 += 1; q.Sx += x; q.Sy += v; q.Sxx += x * x; q.Sxy += x * v; q.Syy += v * v;
  q.last = t; q.n++;
}

function slopeStats(q) {
  const dx = q.S0 * q.Sxx - q.Sx * q.Sx;
  if (q.n < 2 || dx < 1e-9) return null;
  const cov = q.S0 * q.Sxy - q.Sx * q.Sy;
  const dy = q.S0 * q.Syy - q.Sy * q.Sy;
  return { slope: cov / dx, r2: dy > 1e-9 ? (cov * cov) / (dx * dy) : 0, spanH: (q.last - q.t0) / 3.6e6, n: q.n };
}

function drainFlag(q) {
  const st = slopeStats(q);
  return !!st && st.n >= SL.minN && st.spanH >= SL.minSpanH && st.r2 >= SL.minR2
    && st.slope <= SL.slopeVph && -st.slope * st.spanH >= SL.minDropV;
}

const newState = () => ({
  state: 'UNKNOWN', cand: null, n: 0,
  t: 0, ign: null, firstT: null, lastOnT: null, lastRunT: 0,
  restV: null, restN: 0, restT: 0,
  stopV: null, stopN: 0,
  runV: null, runN: 0, proofT: 0,
  lowN: 0,
  sl: newSlope(), drain: false,
  powerCutCount: 0, // corte de alimentación externa
  transitions: []    // historial de transiciones para validar efectividad
});

function chargeState(s, t) {
  if (s.proofT && t - s.proofT < C.proofTtlH * 3.6e6) return true;
  if (s.runN >= C.minRun && s.runV < C.chargeFailV) return false;
  return null;
}

function update(s, m) {
  const { t, v, ign, moving, kmh = 0, fresh = true, charging = true } = m;

  // Si no hay alimentación externa (Bit 2 == false)
  if (charging === false) {
    s.powerCutCount++;
    return s.state; // No degradar la química de la batería si está desconectada
  }

  if (!(v >= 2) || t <= s.t) return s.state;

  s.firstT ??= t;
  const prevIgn = s.ign, prevT = s.t;
  s.t = t; s.ign = ign;
  let evaluate = false;

  if (ign) {
    s.lastOnT = t; s.lowN = 0;
    if (s.sl.t0 !== null) s.sl = newSlope();
    if (moving && kmh >= C.runKmh && fresh) {
      s.runN++;
      s.runV = s.runV == null ? v : s.runV + Math.max(1 / s.runN, 0.15) * (v - s.runV);
      if (v >= C.proofV) s.proofT = t;
    }
    if (v >= C.chargedV) s.lastRunT = t;
  } else {
    if (prevIgn && s.lastRunT === prevT && t - prevT <= C.stopMaxGapMin * 60000) {
      s.stopV = s.stopV == null ? v : s.stopV + 0.4 * (v - s.stopV);
      s.stopN++; evaluate = true;
    }
    const sinceOn = (t - (s.lastOnT ?? s.firstT)) / 60000;
    if (sinceOn >= C.settleMin) {
      const a = s.restV == null ? 1 : 1 - Math.exp(-((t - s.restT) / 60000) / C.tauMin);
      s.restV = s.restV == null ? v : s.restV + a * (v - s.restV);
      s.restT = t; s.restN++; evaluate = true;
      slopeAdd(s.sl, t, v);
    }
    s.lowN = v < C.openV ? s.lowN + 1 : 0;
    if (s.lowN >= 2) evaluate = true;
  }
  if (!evaluate) return s.state;

  const ok = typeof m.charging === 'boolean' ? m.charging : chargeState(s, t);
  const cur = s.state;
  const dmg = C.damagedV + (cur === 'DAMAGED' ? C.band : cur === 'WEAK' ? -C.band : 0);
  const hlt = C.healthyV + (cur === 'WEAK' ? C.band : cur === 'HEALTHY' ? -C.band : 0);

  let cand = null;
  if (s.restN >= 3) {
    const r = s.restV;
    cand = r < C.openV ? 'DAMAGED'
      : r < dmg ? (ok === false ? 'WEAK' : 'DAMAGED')
      : r < hlt ? 'WEAK' : 'HEALTHY';
  }
  if (s.lowN >= 2) cand = 'DAMAGED';
  if (s.stopN >= 2 && ok !== false) {
    if (s.stopV < C.damagedV) cand = 'DAMAGED';
    else if (s.stopV < C.stopWeakV && (cand === null || cand === 'HEALTHY')) cand = 'WEAK';
  }
  s.drain = drainFlag(s.sl);
  if (s.drain && (cand === null || cand === 'HEALTHY')) cand = 'WEAK';

  if (cand === null) return cur;

  if (cur === 'UNKNOWN') {
    s.state = cand;
    s.transitions.push({ t, from: 'UNKNOWN', to: cand, v });
    return s.state;
  }
  if (cand === cur) { s.cand = null; s.n = 0; return cur; }
  if (cand !== s.cand) { s.cand = cand; s.n = 0; }
  if (++s.n >= (RANK[cand] > RANK[cur] ? C.confirmWorse : C.confirmBetter)) {
    const prev = s.state;
    s.state = cand;
    s.cand = null; s.n = 0;
    s.transitions.push({ t, from: prev, to: cand, v });
  }
  return s.state;
}

// =====================================================================
// SIMULACIÓN STREAMING EN TIEMPO REAL
// =====================================================================

const data = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/secuencias_con_estado_y_velocidad.json', 'utf8'));

// Convertir todas las lecturas de los 140 vehículos en un solo stream temporal continuo
const stream = [];
for (const [imei, list] of Object.entries(data)) {
  for (const item of list) {
    stream.push({
      imei,
      t: Date.parse(item.time.replace(' ', 'T') + 'Z'),
      isoTime: item.time,
      v: item.voltage,
      ign: item.ignition,
      moving: item.moving,
      kmh: item.speed || 0,
      charging: item.charging
    });
  }
}

// Ordenar el stream exactamente en el orden cronológico que llegan los paquetes al servidor
stream.sort((a, b) => a.t - b.t);

console.log(`Stream cronológico generado: ${stream.length} paquetes de 140 vehículos.`);
console.log(`Desde: ${stream[0].isoTime} hasta: ${stream[stream.length - 1].isoTime}\n`);

// Mapa de estados O(1) en memoria (como si fuera Redis / State en Worker)
const fleetState = new Map();

for (const msg of stream) {
  let s = fleetState.get(msg.imei);
  if (!s) {
    s = newState();
    fleetState.set(msg.imei, s);
  }
  update(s, msg);
}

// =====================================================================
// REPORTE DE RESULTADOS Y EVALUACIÓN DE EFECTIVIDAD
// =====================================================================

const results = [];
let countHealthy = 0;
let countWeak = 0;
let countDamaged = 0;
let countUnknown = 0;

for (const [imei, s] of fleetState.entries()) {
  const isHealthy = s.state === 'HEALTHY';
  const isWeak = s.state === 'WEAK';
  const isDamaged = s.state === 'DAMAGED';
  const isUnknown = s.state === 'UNKNOWN';

  if (isHealthy) countHealthy++;
  else if (isWeak) countWeak++;
  else if (isDamaged) countDamaged++;
  else countUnknown++;

  const slopeInfo = slopeStats(s.sl);

  results.push({
    imei,
    finalState: s.state,
    restV: s.restV ? +s.restV.toFixed(2) : null,
    stopV: s.stopV ? +s.stopV.toFixed(2) : null,
    runV: s.runV ? +s.runV.toFixed(2) : null,
    drain: s.drain,
    slopeVph: slopeInfo ? +(slopeInfo.slope).toFixed(3) : null,
    powerCuts: s.powerCutCount,
    transitionsCount: s.transitions.length,
    transitions: s.transitions
  });
}

// Guardar resultados
const outJson = path.resolve('server/scratch/reporte-voltajes/resultado_incremental_streaming.json');
fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf8');

console.log('======================================================');
console.log('       RESULTADO GLOBAL DE LA FLOTA (STREAMING)        ');
console.log('======================================================');
console.log(`Total motos monitoreadas : ${results.length}`);
console.log(`🟢 HEALTHY (Sanas)       : ${countHealthy} (${((countHealthy / results.length) * 100).toFixed(1)}%)`);
console.log(`🟡 WEAK    (Débiles)     : ${countWeak} (${((countWeak / results.length) * 100).toFixed(1)}%)`);
console.log(`🔴 DAMAGED (Dañadas)     : ${countDamaged} (${((countDamaged / results.length) * 100).toFixed(1)}%)`);
console.log(`⚪ UNKNOWN (Sin evaluar) : ${countUnknown} (${((countUnknown / results.length) * 100).toFixed(1)}%)`);
console.log('------------------------------------------------------');

// Mostrar vehículos con fallas confirmadas (DAMAGED / WEAK)
console.log('\n--- VEHÍCULOS CON ANOMALÍAS EFECTIVAMENTE CONFIRMADAS ---');
const anomalies = results.filter(r => r.finalState !== 'HEALTHY');

anomalies.forEach((r, idx) => {
  console.log(`\n#${idx + 1} IMEI: ${r.imei} -> ESTADO: [${r.finalState}]`);
  console.log(`   - Reposo Asentado (EWMA): ${r.restV}V`);
  console.log(`   - Tras Apagar: ${r.stopV ? r.stopV + 'V' : 'N/A'} | En Marcha: ${r.runV ? r.runV + 'V' : 'N/A'}`);
  console.log(`   - Descarga continua (drain): ${r.drain} (Pendiente: ${r.slopeVph ? r.slopeVph + ' V/h' : 'N/A'})`);
  console.log(`   - Cortes de energía detectados: ${r.powerCuts}`);
  console.log(`   - Transiciones en el día: ${r.transitions.map(t => `${t.from} -> ${t.to} (${t.v}V)`).join(' | ')}`);
});

