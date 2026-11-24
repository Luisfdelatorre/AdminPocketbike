const fs = require('node:fs');
const path = require('node:path');

const results = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/resultado_incremental_streaming.json', 'utf8'));

console.log('TRANSICIONES TEMPORALES DETECTADAS:');
results.forEach(r => {
  if (r.transitions && r.transitions.length > 0) {
    console.log(`\nIMEI: ${r.imei} (Estado final: ${r.finalState})`);
    r.transitions.forEach((t, i) => {
      const date = new Date(t.t).toISOString().replace('T', ' ').slice(0, 19);
      console.log(`   [Paso ${i + 1}] Hora: ${date} | Cambio: ${t.from} -> ${t.to} | Voltaje: ${t.v}V`);
    });
  }
});

