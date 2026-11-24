const fs = require('node:fs');
const content = fs.readFileSync('client/src/pages/AdminDashboard.css', 'utf8');
const lines = content.split(/\r?\n/);

const startIdx = 185;
const sepIdx = 260;
const endIdx = 419;

// HEAD part has the responsive styles up to line 259
const headPart = lines.slice(startIdx + 1, sepIdx);

// feat part has the fleet-electrical-card CSS rules from line 261 to 418
const fleetCardCss = lines.slice(sepIdx + 1, endIdx);

// Combine: lines 0 to 184 + headPart + fleetCardCss + lines 420 to end
const resolved = [
  ...lines.slice(0, startIdx),
  ...headPart,
  ...fleetCardCss,
  ...lines.slice(endIdx + 1)
];

fs.writeFileSync('client/src/pages/AdminDashboard.css', resolved.join('\n'), 'utf8');
console.log('Successfully resolved AdminDashboard.css conflict!');

