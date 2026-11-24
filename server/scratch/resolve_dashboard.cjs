const fs = require('node:fs');

// We want to resolve the conflict in AdminDashboard.jsx cleanly
// In HEAD (from standardize-payment-summary-header-filters):
// Lines 188-205 were the beginning of the metrics card in mobile.
// Lines 206-315 were the old layout from feat/fleet-battery-health-ui.
// And below 315, HEAD continues with the mobile metrics columns, desktop cards, and table!
// So from line 188 to 316, we simply want:
// 1) The HEAD structure (mobile metrics card or desktop cards)
// 2) PLUS the new fleet-electrical-card right above the recent payments table!

let code = fs.readFileSync('client/src/pages/AdminDashboard.jsx', 'utf8');

// Replace the entire conflict block
const startMarker = '<<<<<<< HEAD';
const endMarker = '>>>>>>> feat/fleet-battery-health-ui\r\n                                </div>\r\n                            </div>';
const altEndMarker = '>>>>>>> feat/fleet-battery-health-ui\n                                </div>\n                            </div>';

// Let's do it with line indices
const lines = code.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes('<<<<<<< HEAD'));
const sepIdx = lines.findIndex((l, i) => i > startIdx && l.includes('======='));
const endIdx = lines.findIndex((l, i) => i > sepIdx && l.includes('>>>>>>> feat/fleet-battery-health-ui'));

console.log('Indices:', { startIdx, sepIdx, endIdx });

// What was in feat/fleet-battery-health-ui that we want?
// The fleet-electrical-card!
const fleetCardLines = [
  '                    {/* Tarjeta KPI Ejecutiva: Salud Eléctrica de la Flota */}',
  '                    <div ',
  '                        className="fleet-electrical-card"',
  '                        onClick={() => navigate(\'/devices\')}',
  '                        title="Ver lista de dispositivos en flota"',
  '                    >',
  '                        <div className="fleet-electrical-header">',
  '                            <div className="fleet-electrical-title-wrap">',
  '                                <div className="fleet-electrical-icon-badge">',
  '                                    <BatteryCharging size={18} />',
  '                                </div>',
  '                                <div>',
  '                                    <h3 className="fleet-electrical-title">Salud Eléctrica de la Flota</h3>',
  '                                    <span className="fleet-electrical-subtitle">',
  '                                        {electricalSummary.total > 0',
  '                                            ? `${electricalSummary.healthy} de ${electricalSummary.total} motos con sistema eléctrico óptimo`',
  '                                            : \'Monitoreo de baterías y alternadores en tiempo real\'}',
  '                                    </span>',
  '                                </div>',
  '                            </div>',
  '                            <div className="fleet-electrical-score-wrap">',
  '                                <span className="fleet-electrical-score">{electricalSummary.healthPercentage}%</span>',
  '                                <span className="fleet-electrical-score-label">Salud General</span>',
  '                            </div>',
  '                        </div>',
  '',
  '                        <div className="fleet-electrical-badges-row">',
  '                            <button ',
  '                                type="button"',
  '                                className="fleet-pill-filter pill-healthy"',
  '                                onClick={(e) => { e.stopPropagation(); navigate(\'/devices?filter=all\'); }}',
  '                                title="Ver todas las motos operando normal"',
  '                            >',
  '                                <span className="pill-dot"></span>',
  '                                <strong>{electricalSummary.healthy}</strong> Sanas',
  '                            </button>',
  '',
  '                            {(electricalSummary.damaged > 0 || electricalSummary.weak > 0) && (',
  '                                <button ',
  '                                    type="button"',
  '                                    className="fleet-pill-filter pill-warning"',
  '                                    onClick={(e) => { e.stopPropagation(); navigate(\'/devices?filter=battery_issue\'); }}',
  '                                    title="Filtrar motos con batería baja o dañada"',
  '                                >',
  '                                    <span className="pill-dot"></span>',
  '                                    <strong>{electricalSummary.damaged + electricalSummary.weak}</strong> Batería Baja/Falla',
  '                                </button>',
  '                            )}',
  '',
  '                            {(electricalSummary.overvoltage > 0 || electricalSummary.noCharge > 0) && (',
  '                                <button ',
  '                                    type="button"',
  '                                    className="fleet-pill-filter pill-danger"',
  '                                    onClick={(e) => { e.stopPropagation(); navigate(\'/devices?filter=alt_issue\'); }}',
  '                                    title="Filtrar motos con falla en alternador o regulador"',
  '                                >',
  '                                    <Zap size={12} className="inline mr-1" />',
  '                                    <strong>{electricalSummary.overvoltage + electricalSummary.noCharge}</strong> Alternador/Carga',
  '                                </button>',
  '                            )}',
  '',
  '                            <span className="fleet-electrical-cta">',
  '                                Ver dispositivos →',
  '                            </span>',
  '                        </div>',
  '                    </div>'
];

// Lines before conflict start (up to line 187)
const part1 = lines.slice(0, startIdx);
// Lines from HEAD (startIdx + 1 to sepIdx)
const headLines = lines.slice(startIdx + 1, sepIdx);
// Lines after endIdx + 1
// Notice that line endIdx was `>>>>>>> feat/fleet-battery-health-ui` and lines after it are the continuation of HEAD!
const afterLines = lines.slice(endIdx + 1);

// Find where table-card-ios begins in afterLines, and insert fleetCardLines right before it!
const tableCardIdx = afterLines.findIndex(l => l.includes('table-card-ios'));
const finalAfterLines = [
  ...afterLines.slice(0, tableCardIdx),
  ...fleetCardLines,
  ...afterLines.slice(tableCardIdx)
];

const resolvedLines = [...part1, ...headLines, ...finalAfterLines];
fs.writeFileSync('client/src/pages/AdminDashboard.jsx', resolvedLines.join('\n'), 'utf8');
console.log('Successfully wrote resolved AdminDashboard.jsx!');

