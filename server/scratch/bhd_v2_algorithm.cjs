/**
 * Battery & Alternator Diagnostics Algorithm (BHD-v2)
 * PocketBike Fleet Management
 * 
 * Basado en telemetría enriquecida GT06:
 * - voltage (V)
 * - ignition (boolean: true = ENCENDIDA, false = APAGADA)
 * - moving (boolean: true = MOVIMIENTO, false = REPOSO)
 * - speed (km/h)
 * - timestamp (ISO / epoch)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const inputJson = path.resolve('server/scratch/reporte-voltajes/secuencias_con_estado_y_velocidad.json');
const outDir = path.resolve('server/scratch/reporte-voltajes');

if (!fs.existsSync(inputJson)) {
  console.error('No se encontró el archivo de secuencias enriquecidas.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputJson, 'utf8'));

/**
 * Función principal de diagnóstico para un vehículo individual
 * @param {string} imei
 * @param {Array<{time: string, voltage: number, ignition: boolean, moving: boolean, speed: number}>} samples
 */
function diagnoseVehicle(imei, samples) {
  if (!samples || samples.length === 0) {
    return { imei, status: 'NO_DATA', score: 0, alerts: [] };
  }

  const alerts = [];
  let score = 100; // Salud inicial 100%

  // Segmentación por estados operativos
  const restingSamples = samples.filter(s => !s.ignition && !s.moving); // Reposo total
  const runningSamples = samples.filter(s => s.ignition || s.moving || s.speed > 0); // En marcha / encendida
  const movingSamples = samples.filter(s => s.moving || s.speed >= 5); // Rodando activamente

  const allVoltages = samples.map(s => s.voltage);
  const minV = Math.min(...allVoltages);
  const maxV = Math.max(...allVoltages);
  const avgV = +(allVoltages.reduce((a, b) => a + b, 0) / allVoltages.length).toFixed(2);

  // -------------------------------------------------------------
  // REGLA 1: Detección de Sobrevoltaje Destructivo
  // Regulador de voltaje quemado/perforado (daña ECU, GPS y batería)
  // -------------------------------------------------------------
  const overVoltageSamples = samples.filter(s => s.voltage >= 15.0);
  const criticalOverVoltage = samples.filter(s => s.voltage >= 15.8);

  if (criticalOverVoltage.length > 0) {
    alerts.push({
      code: 'ERR_CRITICAL_OVERVOLTAGE',
      severity: 'CRITICAL',
      title: 'Sobrevoltaje Extremo Destructivo',
      description: `Se detectaron ${criticalOverVoltage.length} picos de hasta ${maxV}V (límite crítico 15.8V). Riesgo inminente de explosión de batería o quema de componentes electrónicos (ECU/GPS).`,
      evidence: { maxVoltage: maxV, count: criticalOverVoltage.length }
    });
    score -= 60;
  } else if (overVoltageSamples.length >= 2) {
    alerts.push({
      code: 'WARN_HIGH_VOLTAGE',
      severity: 'HIGH',
      title: 'Sobrevoltaje / Regulador Defectuoso',
      description: `El alternador genera voltajes excesivos (${maxV}V >= 15.0V). El regulador-rectificador no está recortando el voltaje.`,
      evidence: { maxVoltage: maxV, count: overVoltageSamples.length }
    });
    score -= 30;
  }

  // -------------------------------------------------------------
  // REGLA 2: Falso Contacto / Borne Suelto / Fusible Flojo
  // Caídas bruscas momentáneas a 0V o < 7V seguidas de voltajes normales
  // -------------------------------------------------------------
  let looseConnectionEvents = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1].voltage;
    const curr = samples[i].voltage;

    // Si cae de voltaje normal (ej > 11V) a cero o < 7V y luego vuelve a subir
    if ((prev >= 11.0 && curr <= 7.0) || (prev <= 7.0 && curr >= 11.0)) {
      looseConnectionEvents++;
    }
  }

  const zeroVoltSamples = samples.filter(s => s.voltage <= 2.0);
  if (looseConnectionEvents >= 2 || (zeroVoltSamples.length > 0 && maxV >= 12.0)) {
    alerts.push({
      code: 'ERR_LOOSE_TERMINAL',
      severity: 'HIGH',
      title: 'Borne Suelto o Falso Contacto',
      description: `Se detectaron ${looseConnectionEvents} oscilaciones drásticas entre voltaje normal y micro-desconexiones (< 7V / 0V). Inspeccionar bornes de batería, masa de chasis y portafusible.`,
      evidence: { microDisconnects: looseConnectionEvents, zeroVoltCount: zeroVoltSamples.length }
    });
    score -= 35;
  }

  // -------------------------------------------------------------
  // REGLA 3: Falla de Carga del Alternador / Estator
  // Vehículo ENCENDIDO o en MOVIMIENTO pero el voltaje NO sube a zona de carga (>= 13.5V)
  // -------------------------------------------------------------
  if (runningSamples.length >= 5) {
    const runningVoltages = runningSamples.map(s => s.voltage);
    const avgRunningV = +(runningVoltages.reduce((a, b) => a + b, 0) / runningVoltages.length).toFixed(2);
    const maxRunningV = Math.max(...runningVoltages);

    // Si estando encendida/en marcha el voltaje nunca supera 12.8V
    if (maxRunningV < 12.8) {
      alerts.push({
        code: 'ERR_NO_ALTERNATOR_CHARGING',
        severity: 'CRITICAL',
        title: 'Alternador No Carga (Descarga en Marcha)',
        description: `Con el motor encendido/en movimiento (${runningSamples.length} muestras), el voltaje promedio fue de apenas ${avgRunningV}V y nunca superó ${maxRunningV}V (esperado >= 13.5V - 14.5V). El vehículo está rodando consumiendo exclusivamente la energía de la batería hasta apagarse.`,
        evidence: { avgRunningVoltage: avgRunningV, maxRunningVoltage: maxRunningV, samplesInRun: runningSamples.length }
      });
      score -= 50;
    } else if (maxRunningV < 13.4 && avgRunningV < 13.0) {
      alerts.push({
        code: 'WARN_WEAK_CHARGING',
        severity: 'MEDIUM',
        title: 'Carga Débil o Insuficiente del Sistema',
        description: `El sistema de carga apenas alcanza ${maxRunningV}V en marcha (promedio ${avgRunningV}V). La carga es insuficiente para mantener la batería al 100% durante trayectos urbanos o nocturnos con luces encendidas.`,
        evidence: { avgRunningVoltage: avgRunningV, maxRunningVoltage: maxRunningV }
      });
      score -= 20;
    }
  }

  // -------------------------------------------------------------
  // REGLA 4: Batería Degradada, Agotada o Muerta
  // Análisis del voltaje en REPOSO (química de la celda de plomo-ácido / AGM)
  // -------------------------------------------------------------
  if (restingSamples.length >= 5) {
    const restingVoltages = restingSamples.map(s => s.voltage);
    const avgRestingV = +(restingVoltages.reduce((a, b) => a + b, 0) / restingVoltages.length).toFixed(2);
    const minRestingV = Math.min(...restingVoltages);

    // Descarga profunda crítica (< 11.5V en reposo)
    if (avgRestingV < 11.5 || minRestingV < 11.2) {
      alerts.push({
        code: 'ERR_BATTERY_DEAD_OR_DEEP_DISCHARGE',
        severity: 'CRITICAL',
        title: 'Batería Muerta o Descarga Profunda',
        description: `En reposo con switch apagado, el voltaje promedio fue de ${avgRestingV}V (mínimo ${minRestingV}V). Batería sulfatada, celda comunicada o incapacidad total de retención de carga. El vehículo no podrá encender por arranque eléctrico.`,
        evidence: { avgRestingVoltage: avgRestingV, minRestingVoltage: minRestingV, samplesResting: restingSamples.length }
      });
      score -= 45;
    }
    // Batería baja / degradada (11.5V - 12.2V en reposo)
    else if (avgRestingV < 12.2) {
      alerts.push({
        code: 'WARN_BATTERY_LOW_CAPACITY',
        severity: 'HIGH',
        title: 'Batería Baja / Capacidad Degradada',
        description: `El voltaje en reposo promedio es de ${avgRestingV}V (esperado 12.6V - 12.8V). Indica batería al ~40% de carga o pérdida severa de vida útil (resistencia interna elevada).`,
        evidence: { avgRestingVoltage: avgRestingV, samplesResting: restingSamples.length }
      });
      score -= 25;
    }

    // -------------------------------------------------------------
    // Detección de Fuga Parásita / Consumo Anormal con Motor Apagado
    // Caída sostenida en el tiempo durante reposo prolongado
    // -------------------------------------------------------------
    if (restingSamples.length >= 20) {
      const first5 = restingSamples.slice(0, 5).reduce((s, x) => s + x.voltage, 0) / 5;
      const last5 = restingSamples.slice(-5).reduce((s, x) => s + x.voltage, 0) / 5;
      const deltaDrop = +(first5 - last5).toFixed(2);

      // Si cayó más de 0.6V en reposo sin que se encendiera
      if (deltaDrop >= 0.6 && last5 < 12.3) {
        alerts.push({
          code: 'WARN_PARASITIC_DRAIN',
          severity: 'MEDIUM',
          title: 'Descarga Parásita en Reposo',
          description: `La batería se descargó de ${first5.toFixed(2)}V a ${last5.toFixed(2)}V (caída de ${deltaDrop}V) mientras el vehículo estuvo apagado. Posible fuga de corriente o accesorio mal conectado.`,
          evidence: { initialRestVoltage: +first5.toFixed(2), finalRestVoltage: +last5.toFixed(2), drop: deltaDrop }
        });
        score -= 15;
      }
    }
  }

  // Ajuste final de score de salud
  score = Math.max(0, Math.min(100, score));

  let healthStatus = 'EXCELENTE';
  if (score < 50) healthStatus = 'CRÍTICO';
  else if (score < 75) healthStatus = 'ADVERTENCIA';
  else if (score < 90) healthStatus = 'ACEPTABLE';

  return {
    imei,
    score,
    healthStatus,
    stats: {
      samplesTotal: samples.length,
      samplesResting: restingSamples.length,
      samplesRunning: runningSamples.length,
      samplesMoving: movingSamples.length,
      minV,
      maxV,
      avgV
    },
    alerts
  };
}

// -------------------------------------------------------------
// Ejecución sobre toda la flota (140 vehículos)
// -------------------------------------------------------------
const fleetResults = [];

for (const [imei, samples] of Object.entries(data)) {
  const diag = diagnoseVehicle(imei, samples);
  fleetResults.push(diag);
}

// Ordenar de peor a mejor salud
fleetResults.sort((a, b) => a.score - b.score || b.alerts.length - a.alerts.length);

// Métricas globales de la flota
const criticalVehicles = fleetResults.filter(v => v.healthStatus === 'CRÍTICO');
const warningVehicles = fleetResults.filter(v => v.healthStatus === 'ADVERTENCIA');
const healthyVehicles = fleetResults.filter(v => v.score >= 75);

// Guardar informe completo en JSON
const reportPath = path.join(outDir, 'diagnostico_bateria_algoritmo.json');
fs.writeFileSync(reportPath, JSON.stringify(fleetResults, null, 2), 'utf8');

// Guardar informe en CSV ejecutivo
function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}
const csvRows = [
  ['imei', 'salud_score', 'estado_salud', 'muestras', 'min_v', 'max_v', 'avg_v', 'alertas_totales', 'codigos_alerta', 'resumen_alertas']
];

for (const v of fleetResults) {
  csvRows.push([
    v.imei,
    v.score,
    v.healthStatus,
    v.stats.samplesTotal,
    v.stats.minV,
    v.stats.maxV,
    v.stats.avgV,
    v.alerts.length,
    v.alerts.map(a => a.code).join(' | '),
    v.alerts.map(a => `[${a.severity}] ${a.title}`).join(' ; ')
  ]);
}

const csvSummaryPath = path.join(outDir, 'diagnostico_bateria_resumen.csv');
fs.writeFileSync(csvSummaryPath, csvRows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');

console.log('=== REPORTE DE SALUD ELÉCTRICA DE LA FLOTA ===');
console.log(`Vehículos totales analizados: ${fleetResults.length}`);
console.log(`🔴 En estado CRÍTICO (Score < 50): ${criticalVehicles.length} motos`);
console.log(`🟡 En ADVERTENCIA (Score 50-74): ${warningVehicles.length} motos`);
console.log(`🟢 Operación NORMAL (Score >= 75): ${healthyVehicles.length} motos`);

console.log('\nTop 10 vehículos con fallas detectadas:');
fleetResults.slice(0, 10).forEach(v => {
  console.log(`IMEI: ${v.imei} | Salud: ${v.score}% (${v.healthStatus}) | Min: ${v.stats.minV}V Max: ${v.stats.maxV}V | Alertas: ${v.alerts.length}`);
  v.alerts.forEach(a => console.log(`   -> [${a.severity}] ${a.title}: ${a.description.slice(0, 95)}...`));
});

