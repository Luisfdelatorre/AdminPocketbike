const fs = require('node:fs');
const path = require('node:path');

const results = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/resultado_incremental_streaming.json', 'utf8'));

// Find multiple transitions
const multi = results.filter(r => r.transitions && r.transitions.length > 1);
console.log(`Vehículos con múltiples transiciones durante el día: ${multi.length}`);
multi.forEach(m => {
  console.log(`\nIMEI ${m.imei} (Estado Final: ${m.finalState})`);
  m.transitions.forEach((t, i) => {
    console.log(`  Paso ${i+1}: ${t.from} -> ${t.to} a las ${new Date(t.t).toISOString().replace('T', ' ').slice(0, 19)} (V=${t.v})`);
  });
});

