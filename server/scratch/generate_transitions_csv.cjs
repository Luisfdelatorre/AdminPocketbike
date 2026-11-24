const fs = require('node:fs');
const path = require('node:path');

const results = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/resultado_incremental_streaming.json', 'utf8'));

function csvEscape(v) {
  const str = String(v ?? '');
  return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

const headers = [
  'imei',
  'timestamp_evento',
  'paso',
  'estado_anterior',
  'nuevo_estado',
  'voltaje_disparo_V',
  'motivo_transicion'
];

const rows = [headers];

for (const r of results) {
  if (r.transitions && r.transitions.length > 0) {
    r.transitions.forEach((t, i) => {
      let motivo = '';
      if (t.from === 'UNKNOWN') {
        motivo = `Primer veredicto confirmado tras ${t.to === 'DAMAGED' ? 'colapso severo' : '3 horas de reposo asentado'}`;
      } else if (t.from === 'HEALTHY' && t.to === 'WEAK') {
        motivo = 'Voltaje cayó por debajo de 12.2V durante reposo prolongado (descarga)';
      } else if (t.from === 'WEAK' && t.to === 'DAMAGED') {
        motivo = 'Voltaje cayó por debajo de 11.8V (descarga profunda / fuga continua)';
      } else if (t.from === 'WEAK' && t.to === 'HEALTHY') {
        motivo = 'Vehículo rodó con alternador cargando y estabilizó reposo >= 12.3V';
      }

      rows.push([
        r.imei,
        new Date(t.t).toISOString().replace('T', ' ').slice(0, 19),
        i + 1,
        t.from,
        t.to,
        t.v,
        motivo
      ]);
    });
  }
}

const outCsv = path.resolve('server/scratch/reporte-voltajes/historial_transiciones_tiempo.csv');
fs.writeFileSync(outCsv, rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
console.log('Historial guardado en:', outCsv);

