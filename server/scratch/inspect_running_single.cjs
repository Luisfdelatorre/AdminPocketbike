const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/secuencias_con_estado_y_velocidad.json', 'utf8'));

// Look at IMEI 865468052790410
const samples = data['865468052790410'];
console.log('Total samples for 865468052790410:', samples.length);
console.log('Running samples:');
console.log(samples.filter(s => s.ignition || s.moving || s.speed > 0));

