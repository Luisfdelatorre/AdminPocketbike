const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/secuencias_con_estado_y_velocidad.json', 'utf8'));
const samples = data['865468052800912'];

console.log('Evolución temporal para IMEI 865468052800912:');
samples.slice(0, 40).forEach(s => {
  console.log(`${s.time} | V: ${s.voltage} | Ign: ${s.ignition} | Mov: ${s.moving} | Speed: ${s.speed}`);
});

