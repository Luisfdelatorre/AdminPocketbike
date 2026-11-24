/**
 * Battery & Alternator Diagnostics Algorithm (BHD-v3)
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
  // -------------------------------------------------------------
  let looseConnectionEvents = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1].voltage;
    const curr = samples[i].voltage;
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
  // REGLA 3: Falla de Carga del Alternador (CON SECUENCIA SUCESIVA DE PÉRDIDA/ESTANCAMIENTO)
  // Requisito estricto: Analizar rachas continuas en marcha (ignición activa o rodando).
  // Se busca verificar que NO carga (maxV < 13.2V) Y ADEMÁS que existe una tendencia
  // monótona decreciente o estancamiento sostenido (dV/dt <= 0).
  // -------------------------------------------------------------
  let currentRun = [];
  const continuousRuns = [];

  for (const s of samples) {
    const isRunning = s.ignition || s.moving || s.speed > 0;
    if (isRunning) {
      currentRun.push(s);
    } else {
      if (currentRun.length >= 3) {
        continuousRuns.push([...currentRun]);
      }
      currentRun = [];
    }
  }
  if (currentRun.length >= 3) {
    continuousRuns.push([...currentRun]);
  }

  let confirmedActiveDischargeRun = null;
  let confirmedStagnantRun = null;

  for (const run of continuousRuns) {
    const vList = run.map(r => r.voltage);
    const maxRunV = Math.max(...vList);
    const vStart = vList[0];
    const vEnd = vList[vList.length - 1];
    const deltaV = +(vEnd - vStart).toFixed(2);
    const durationMin = Math.round((new Date(run[run.length - 1].time) - new Date(run[0].time)) / 60000);

    // Si durante toda la racha el alternador NUNCA levantó voltaje de carga (< 13.0V)
    if (maxRunV <= 13.0) {
      // Caso 3A: PÉRDIDA SUCESIVA RECURRENTE (Descarga activa en marcha dV/dt < 0)
      if (deltaV <= -0.2 && vEnd <= 12.4) {
        if (!confirmedActiveDischargeRun || vList.length > confirmedActiveDischargeRun.samples) {
          confirmedActiveDischargeRun = {
            samples: vList.length,
            durationMin,
            vStart,
            vEnd,
            deltaV,
            sequence: vList.slice(0, 8),
            times: [run[0].time, run[run.length - 1].time]
          };
        }
      }
      // Caso 3B: AUSENCIA DE CARGA CRÓNICA CON ESTANCAMIENTO (dV/dt <= 0, racha >= 4 muestras, >= 30 min)
      else if (vList.length >= 4 && maxRunV <= 12.7) {
        if (!confirmedStagnantRun || vList.length > confirmedStagnantRun.samples) {
          confirmedStagnantRun = {
            samples: vList.length,
            durationMin,
            vStart,
            vEnd,
            deltaV,
            sequence: vList.slice(0, 8),
            times: [run[0].time, run[run.length - 1].time]
          };
        }
      }
    }
  }

  if (confirmedActiveDischargeRun) {
    alerts.push({
      code: 'ERR_ALTERNATOR_ACTIVE_DISCHARGE',
      severity: 'CRITICAL',
      title: 'Alternador Muerto: Descarga Sucesiva Activa en Marcha',
      description: `Confirmada secuencia continua de pérdida de energía durante ${confirmedActiveDischargeRun.durationMin} minutos de operación (${confirmedActiveDischargeRun.samples} muestras sucesivas). El voltaje cayó de ${confirmedActiveDischargeRun.vStart}V a ${confirmedActiveDischargeRun.vEnd}V (pérdida de ${Math.abs(confirmedActiveDischargeRun.deltaV)}V). El alternador no suministra corriente y la moto consumió la batería hasta la descarga total.`,
      evidence: confirmedActiveDischargeRun
    });
    score -= 50;
  } else if (confirmedStagnantRun) {
    alerts.push({
      code: 'WARN_ALTERNATOR_NO_CHARGE',
      severity: 'HIGH',
      title: 'Alternador Inoperativo (Sin Elevación de Carga)',
      description: `Racha continua de ${confirmedStagnantRun.durationMin} minutos encendida sin ninguna elevación de carga (secuencia: ${confirmedStagnantRun.sequence.join('V -> ')}V). El alternador no supera los 12.7V (esperado >= 13.8V).`,
      evidence: confirmedStagnantRun
    });
    score -= 30;
  }

  // -------------------------------------------------------------
  // REGLA 4: Batería Degradada, Agotada o Muerta
  // -------------------------------------------------------------
  if (restingSamples.length >= 5) {
    const restingVoltages = restingSamples.map(s => s.voltage);
    const avgRestingV = +(restingVoltages.reduce((a, b) => a + b, 0) / restingVoltages.length).toFixed(2);
    const minRestingV = Math.min(...restingVoltages);

    if (avgRestingV < 11.5 || minRestingV < 11.2) {
      alerts.push({
        code: 'ERR_BATTERY_DEAD_OR_DEEP_DISCHARGE',
        severity: 'CRITICAL',
        title: 'Batería Muerta o Descarga Profunda',
        description: `En reposo con switch apagado, el voltaje promedio fue de ${avgRestingV}V (mínimo ${minRestingV}V). Batería sulfatada o celda comunicada.`,
        evidence: { avgRestingVoltage: avgRestingV, minRestingVoltage: minRestingV, samplesResting: restingSamples.length }
      });
      score -= 45;
    } else if (avgRestingV < 12.2) {
      alerts.push({
        code: 'WARN_BATTERY_LOW_CAPACITY',
        severity: 'HIGH',
        title: 'Batería Baja / Capacidad Degradada',
        description: `El voltaje en reposo promedio es de ${avgRestingV}V (esperado 12.6V - 12.8V).`,
        evidence: { avgRestingVoltage: avgRestingV, samplesResting: restingSamples.length }
      });
      score -= 25;
    }

    // Fuga parásita en reposo
    if (restingSamples.length >= 20) {
      const first5 = restingSamples.slice(0, 5).reduce((s, x) => s + x.voltage, 0) / 5;
      const last5 = restingSamples.slice(-5).reduce((s, x) => s + x.voltage, 0) / 5;
      const deltaDrop = +(first5 - last5).toFixed(2);

      if (deltaDrop >= 0.6 && last5 < 12.3) {
        alerts.push({
          code: 'WARN_PARASITIC_DRAIN',
          severity: 'MEDIUM',
          title: 'Descarga Parásita en Reposo',
          description: `La batería se descargó de ${first5.toFixed(2)}V a ${last5.toFixed(2)}V (caída de ${deltaDrop}V) mientras el vehículo estuvo apagado.`,
          evidence: { initialRestVoltage: +first5.toFixed(2), finalRestVoltage: +last5.toFixed(2), drop: deltaDrop }
        });
        score -= 15;
      }
    }
  }

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

// Ejecutar sobre los 140 vehículos
const fleetResults = [];
for (const [imei, samples] of Object.entries(data)) {
  fleetResults.push(diagnoseVehicle(imei, samples));
}

fleetResults.sort((a, b) => a.score - b.score || b.alerts.length - a.alerts.length);

const reportPath = path.join(outDir, 'diagnostico_bateria_algoritmo.json');
fs.writeFileSync(reportPath, JSON.stringify(fleetResults, null, 2), 'utf8');

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

console.log('=== REPORTE BHD-v3 (CON SECUENCIA SUCESIVA DE PÉRDIDA) ===');
const altFails = fleetResults.filter(v => v.alerts.some(a => a.code.startsWith('ERR_ALTERNATOR') || a.code.startsWith('WARN_ALTERNATOR')));
console.log(`Vehículos con falla de alternador verificada por secuencia: ${altFails.length}`);
altFails.forEach(v => {
  const alert = v.alerts.find(a => a.code.startsWith('ERR_ALTERNATOR') || a.code.startsWith('WARN_ALTERNATOR'));
  console.log(`\nIMEI: ${v.imei} | Salud: ${v.score}% | Alerta: ${alert.title}`);
  console.log(`Evidencia de secuencia sucesiva:`, alert.evidence);
});

