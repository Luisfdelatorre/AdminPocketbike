const fs = require('node:fs');
const path = require('node:path');

const jsonPath = path.resolve(__dirname, './reporte-voltajes/todas_secuencias_sinteticas.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Formato compacto de 1 línea por IMEI
const compactMap = {};
for (const [imei, seq] of Object.entries(data)) {
    compactMap[imei] = seq;
}

const outText = Object.entries(compactMap)
    .map(([imei, seq]) => `"${imei}": [${seq.join(', ')}]`)
    .join(',\n');

const fullJsonCompact = '{\n' + outText + '\n}';

const outPath = path.resolve(__dirname, './reporte-voltajes/secuencias_140_compacto.json');
fs.writeFileSync(outPath, fullJsonCompact, 'utf8');

const copyPath = 'C:/Users/luisd/.gemini/antigravity/brain/300777d1-45b4-4515-8e7d-24526a24cc3e/secuencias_140_compacto.json';
fs.writeFileSync(copyPath, fullJsonCompact, 'utf8');

console.log('Total IMEIs:', Object.keys(compactMap).length);
console.log('Generado en:', outPath);

