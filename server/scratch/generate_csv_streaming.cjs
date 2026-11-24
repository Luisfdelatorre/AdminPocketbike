const fs = require('node:fs');
const path = require('node:path');

const results = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/resultado_incremental_streaming.json', 'utf8'));

function csvEscape(v) {
  const str = String(v ?? '');
  return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

const headers = [
  'imei',
  'estado_tiempo_real',
  'efectividad_diagnostico',
  'reposo_asentado_V',
  'voltaje_tras_apagar_V',
  'voltaje_en_marcha_V',
  'descarga_continua_drain',
  'pendiente_Vph',
  'cortes_energia_detectados',
  'transiciones_estado'
];

const rows = [headers];

for (const r of results) {
  let efectividad = 'NORMAL (Sana confirmada)';
  if (r.finalState === 'DAMAGED') {
    if (r.powerCuts > 10) efectividad = 'EFECTIVO: Borne suelto / Falso contacto (58 cortes a 0V)';
    else if (r.drain) efectividad = 'EFECTIVO: Fuga parásita progresiva continua';
    else if (r.restV && r.restV < 10) efectividad = 'EFECTIVO: Celda comunicada / Destruida (<9V)';
    else efectividad = 'EFECTIVO: Batería degradada en reposo (<11.8V)';
  } else if (r.finalState === 'WEAK') {
    efectividad = 'EFECTIVO: Carga débil o degradación incipiente (<12.2V)';
  } else if (r.finalState === 'UNKNOWN') {
    efectividad = 'PENDIENTE: Rodando continuamente sin reposo';
  }

  rows.push([
    r.imei,
    r.finalState,
    efectividad,
    r.restV ?? '',
    r.stopV ?? '',
    r.runV ?? '',
    r.drain ? 'SI' : 'NO',
    r.slopeVph ?? '',
    r.powerCuts,
    r.transitions.map(t => `${t.from}->${t.to}(${t.v}V)`).join(' | ')
  ]);
}

const outCsv = path.resolve('server/scratch/reporte-voltajes/listado_estados_tiempo_real.csv');
fs.writeFileSync(outCsv, rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
console.log('CSV guardado en:', outCsv);

