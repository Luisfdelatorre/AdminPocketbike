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

// Generar para los 140 IMEIs:
// 1. Secuencia completa original (todas las lecturas ordenadas)
// 2. Muestreo sintético uniforme (resample a exactamente 30 puntos por dispositivo para análisis directo por array)

const allDevicesRaw = {};
const allDevicesSynthetic = {};

for (const [imei, seq] of imeiMap.entries()) {
    allDevicesRaw[imei] = seq;

    // Resample uniforme de 30 puntos
    const targetLength = Math.min(30, seq.length);
    const sampled = [];
    const step = (seq.length - 1) / (targetLength - 1 || 1);
    for (let j = 0; j < targetLength; j++) {
        const idx = Math.round(j * step);
        sampled.push(seq[idx]);
    }
    allDevicesSynthetic[imei] = sampled;
}

const outDir = path.resolve(__dirname, './reporte-voltajes');

// Archivo 1: Sintéticas normalizadas (30 puntos c/u) para los 140 dispositivos
const outSynthetic = path.join(outDir, 'todas_secuencias_sinteticas.json');
fs.writeFileSync(outSynthetic, JSON.stringify(allDevicesSynthetic, null, 2), 'utf8');

// Archivo 2: Todas las lecturas reales completas para los 140 dispositivos
const outRaw = path.join(outDir, 'todas_secuencias_completas.json');
fs.writeFileSync(outRaw, JSON.stringify(allDevicesRaw, null, 2), 'utf8');

// Archivo 3: Formato CSV plano (imei, sequence_comma_separated)
const csvRows = ['imei,total_samples,voltage_sequence'];
for (const [imei, seq] of Object.entries(allDevicesSynthetic)) {
    csvRows.push(`${imei},${seq.length},"${seq.join(';')}"`);
}
const outCsv = path.join(outDir, 'todas_secuencias_sinteticas.csv');
fs.writeFileSync(outCsv, csvRows.join('\n'), 'utf8');

console.log('Procesados ' + imeiMap.size + ' dispositivos.');
console.log('Generado:', outSynthetic);
console.log('Generado:', outRaw);
console.log('Generado:', outCsv);

