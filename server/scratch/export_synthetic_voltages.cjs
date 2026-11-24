const fs = require('node:fs');
const path = require('node:path');

const inputCsv = path.resolve(__dirname, './reporte-voltajes/voltajes.csv');
const content = fs.readFileSync(inputCsv, 'utf8');

const lines = content.split('\n');
const imeiMap = new Map();

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const imei = parts[0].replace(/"/g, '');
    const v = parseFloat(parts[3]);
    if (!isNaN(v)) {
        if (!imeiMap.has(imei)) imeiMap.set(imei, []);
        imeiMap.get(imei).push(v);
    }
}

// Escoger casos representativos:
// 1. Caso Borne / Desconexión (0V y picos)
// 2. Caso Batería Agotada (< 11.5V)
// 3. Caso Batería Débil
// 4. Caso Normal en Marcha (12.5V a 14.5V)
// 5. Caso Normal Reposo (12.6V a 12.8V)

const targetImeis = [
    '865468053668763', // Borne suelto / 0V
    '865468052807941', // Batería baja / 11V
    '865468052794461', // Batería débil / 10.2V
    '865468052755025', // Normal activa con carga (12.1 - 14.4V)
    '865468052804294'  // Normal reposo (12.6 - 12.7V)
];

const syntheticDataset = {};

for (const imei of targetImeis) {
    const seq = imeiMap.get(imei) || [];
    // Muestreo de hasta 40 puntos para no saturar tokens pero conservar la forma exacta
    const step = Math.max(1, Math.floor(seq.length / 30));
    const sampled = [];
    for (let j = 0; j < seq.length; j += step) {
        sampled.push(seq[j]);
    }
    syntheticDataset[imei] = sampled;
}

const outJson = path.resolve(__dirname, './reporte-voltajes/secuencias_voltaje_sinteticas.json');
fs.writeFileSync(outJson, JSON.stringify(syntheticDataset, null, 2), 'utf8');
console.log('JSON generado en:', outJson);
console.log(JSON.stringify(syntheticDataset, null, 2));

