#!/usr/bin/env node
'use strict';

// Usage:
// node analizar_voltajes_gt06.js /opt/traccar/logs/tracker-server.log ./reporte-voltajes
//
// Requires Node.js >= 18. No npm dependencies.

const fs = require('node:fs');
const readline = require('node:readline');
const path = require('node:path');

const source =
  process.argv[2] || path.resolve(__dirname, '../tracker-server.log');

const destination = path.resolve(
  process.argv[3] || path.resolve(__dirname, './reporte-voltajes')
);

// GS10G hypothesis: raw unit = 0.01 V.
// Verify this scale against a physical multimeter reading.
const SCALE = 100;

const packetRe =
  /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+): gt06 < [^\]]+\]\s+([0-9a-f]+)\s*$/i;

const identityRe =
  /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+\w+: \[(T[0-9a-f]+)\]\s+id:\s*(\d+),/i;

const pending = new Map();
const records = [];

let countPackets = 0;
let unmatched = 0;

function csvEscape(value) {
  const str = String(value ?? '');

  return /[",\r\n]/.test(str)
    ? '"' + str.replace(/"/g, '""') + '"'
    : str;
}

function csv(rows) {
  return (
    rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n'
  );
}

function parseLocalTimestamp(time) {
  return Date.parse(time.replace(' ', 'T') + 'Z');
}

function escapeScriptJSON(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error('No existe: ' + source);
  }

  fs.mkdirSync(destination, { recursive: true });

  const rl = readline.createInterface({
    input: fs.createReadStream(source, {
      encoding: 'utf8'
    }),
    crlfDelay: Infinity
  });

  // -----------------------------------------------------
  // 1. Parse Traccar logs and extract voltage packets
  // -----------------------------------------------------

  for await (const line of rl) {
    const pkt = packetRe.exec(line);

    if (pkt) {
      const [, receivedAt, thread, hexText] = pkt;
      const hex = hexText.toLowerCase();

      // Packet structure:
      //
      // 79 79 | 00 08 | 94 | 00 | voltage(2)
      // serial(2) | CRC(2) | 0D 0A
      //
      // Protocol 0x94
      // Information type 0x00 = external voltage

      if (
        hex.startsWith('797900089400') &&
        hex.endsWith('0d0a') &&
        hex.length >= 28 &&
        hex.length <= 30
      ) {
        const raw = Number.parseInt(
          hex.slice(12, 16),
          16
        );

        countPackets++;

        pending.set(thread, {
          receivedAt,
          raw,
          hex,
          epoch: parseLocalTimestamp(receivedAt)
        });
      }

      continue;
    }

    // Traccar usually prints the IMEI in the next line
    // using the same connection/thread identifier.

    const id = identityRe.exec(line);

    if (id) {
      const [, , thread, imei] = id;

      const p = pending.get(thread);

      if (p) {
        pending.delete(thread);

        const voltage = p.raw / SCALE;

        if (voltage >= 0 && voltage <= 100) {
          records.push({
            imei,
            receivedAt: p.receivedAt,
            epoch: p.epoch,
            raw: p.raw,
            voltage,
            hex: p.hex
          });
        }
      }
    }
  }

  unmatched = pending.size;

  // -----------------------------------------------------
  // 2. Sort readings chronologically
  // -----------------------------------------------------

  records.sort(
    (a, b) =>
      a.epoch - b.epoch ||
      a.imei.localeCompare(b.imei)
  );

  // -----------------------------------------------------
  // 3. Group readings by motorcycle IMEI
  // -----------------------------------------------------

  const groups = new Map();

  for (const rec of records) {
    if (!groups.has(rec.imei)) {
      groups.set(rec.imei, []);
    }

    groups.get(rec.imei).push(rec);
  }

  // -----------------------------------------------------
  // 4. Calculate statistics per motorcycle
  // -----------------------------------------------------

  const summary = [...groups]
    .map(([imei, arr]) => {
      const values = arr.map(x => x.voltage);

      const min = Math.min(...values);
      const max = Math.max(...values);

      const avg =
        values.reduce((s, v) => s + v, 0) /
        values.length;

      return {
        imei,
        n: arr.length,
        min: +min.toFixed(2),
        max: +max.toFixed(2),
        avg: +avg.toFixed(2),
        range: +(max - min).toFixed(2),

        low: arr.filter(
          x => x.voltage < 11.5
        ).length,

        high: arr.filter(
          x => x.voltage >= 13.5
        ).length,

        first: arr[0].receivedAt,
        last: arr.at(-1).receivedAt
      };
    })
    .sort((a, b) => b.n - a.n);

  // -----------------------------------------------------
  // 5. Export voltage CSV
  // -----------------------------------------------------

  fs.writeFileSync(
    path.join(destination, 'voltajes.csv'),
    csv([
      [
        'imei',
        'received_at_server',
        'raw_decimal',
        'voltage_V_estimated',
        'packet_hex'
      ],
      ...records.map(x => [
        x.imei,
        x.receivedAt,
        x.raw,
        x.voltage.toFixed(2),
        x.hex
      ])
    ])
  );

  // -----------------------------------------------------
  // 6. Export summary CSV
  // -----------------------------------------------------

  fs.writeFileSync(
    path.join(destination, 'resumen.csv'),
    csv([
      [
        'imei',
        'samples',
        'min_V',
        'max_V',
        'average_V',
        'range_V',
        'samples_below_11_5V',
        'samples_above_13_5V',
        'first',
        'last'
      ],
      ...summary.map(x => [
        x.imei,
        x.n,
        x.min,
        x.max,
        x.avg,
        x.range,
        x.low,
        x.high,
        x.first,
        x.last
      ])
    ])
  );

  // -----------------------------------------------------
  // 7. Prepare graph data
  // -----------------------------------------------------

  const data = Object.fromEntries(
    [...groups].map(([imei, arr]) => [
      imei,
      arr.map(x => [x.epoch, x.voltage])
    ])
  );

  // -----------------------------------------------------
  // 8. Generate interactive HTML report
  // -----------------------------------------------------

  const html = `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>PocketBike — Voltaje externo GT06</title>

<style>
:root {
  font-family: system-ui, -apple-system, Segoe UI, sans-serif;
  color: #1b2330;
  background: #f4f7fa;
}

body {
  max-width: 1250px;
  margin: 30px auto;
  padding: 0 18px;
}

h1 {
  margin-bottom: 4px;
}

p {
  color: #526072;
}

.panel {
  background: white;
  border-radius: 13px;
  padding: 20px;
  margin: 18px 0;
  box-shadow: 0 2px 12px #22341212;
}

select, input {
  font: inherit;
  padding: 9px;
  border-radius: 8px;
  border: 1px solid #bdc8d3;
}

input {
  width: 200px;
  max-width: 100%;
}

label {
  display: inline-block;
  margin: 8px 12px 8px 0;
}

svg {
  width: 100%;
  height: auto;
  display: block;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th, td {
  padding: 9px 8px;
  border-bottom: 1px solid #e6eaf0;
  text-align: left;
}

th {
  background: #f3f5f8;
  position: sticky;
  top: 0;
}

tr:hover {
  background: #edf6ff;
  cursor: pointer;
}

.scroll {
  max-height: 460px;
  overflow: auto;
}

.small {
  font-size: 13px;
  color: #647084;
}

.kpi {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
}

.kpi > div {
  min-width: 135px;
}

.kpi strong {
  font-size: 22px;
  display: block;
}
</style>
</head>

<body>

<h1>PocketBike — Monitoreo de voltaje externo</h1>

<p>
  Tramas GT06 <code>0x94 / 0x00</code>.
  Escala estimada: valor bruto / 100.
  Verificar con multímetro.
</p>

<section class="panel kpi">
  <div>
    <strong>${records.length}</strong>
    Lecturas
  </div>
  <div>
    <strong>${summary.length}</strong>
    Dispositivos
  </div>
  <div>
    <strong>${countPackets}</strong>
    Tramas de voltaje
  </div>
  <div>
    <strong>${unmatched}</strong>
    Sin IMEI asociado
  </div>
</section>

<section class="panel">
  <label>
    Dispositivo
    <select id="dev"></select>
  </label>

  <label>
    <input id="search" placeholder="Buscar IMEI">
  </label>

  <div id="details" class="small"></div>
  <div id="chart"></div>

  <p class="small">
    Las líneas horizontales de 12,6 V y 13,5 V
    son referencias orientativas, no diagnósticos.
    El eje temporal usa la hora del servidor.
  </p>
</section>

<section class="panel">
  <h2>Comparación de la flota</h2>

  <p>Haz clic en una fila para mostrar su gráfica.</p>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th>IMEI</th>
          <th>Muestras</th>
          <th>Mínimo</th>
          <th>Máximo</th>
          <th>Promedio</th>
          <th>Rango</th>
          <th>&lt; 11,5 V</th>
          <th>≥ 13,5 V</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
</section>

<script>

const data = ${escapeScriptJSON(data)};
const summary = ${escapeScriptJSON(summary)};

const sel = document.getElementById('dev');
const search = document.getElementById('search');
const rows = document.getElementById('rows');
const detail = document.getElementById('details');
const chart = document.getElementById('chart');

function elem(tag, attrs, text) {
  const e = document.createElementNS(
    'http://www.w3.org/2000/svg',
    tag
  );

  for (const [k, v] of Object.entries(attrs || {})) {
    e.setAttribute(k, v);
  }

  if (text !== undefined) {
    e.textContent = text;
  }

  return e;
}

// Populate device selector
for (const s of summary) {
  const o = document.createElement('option');

  o.value = s.imei;
  o.textContent =
    s.imei + ' (' + s.n + ' lecturas)';

  sel.append(o);
}

// -----------------------------------------------------
// Draw voltage graph for selected device
// -----------------------------------------------------

function draw(imei) {
  const s = summary.find(s => s.imei === imei);
  const pts = data[imei] || [];

  if (!s || !pts.length) return;

  detail.textContent =
    s.n + ' lecturas · ' +
    s.min.toFixed(2) + '–' +
    s.max.toFixed(2) + ' V · promedio ' +
    s.avg.toFixed(2) + ' V · ' +
    s.first + ' a ' + s.last;

  const W = 1080;
  const H = 385;

  const left = 66;
  const right = 18;
  const top = 20;
  const bottom = 60;

  const xs = pts.map(p => p[0]);
  const vs = pts.map(p => p[1]);

  let xmin = Math.min(...xs);
  let xmax = Math.max(...xs);

  if (xmin === xmax) {
    xmax = xmin + 1000;
  }

  let ymin = Math.min(
    11.5,
    Math.min(...vs) - 0.4
  );

  let ymax = Math.max(
    14.5,
    Math.max(...vs) + 0.4
  );

  if (ymax - ymin < 2) {
    ymax += 1;
    ymin -= 1;
  }

  const px = t =>
    left +
    (t - xmin) / (xmax - xmin) *
    (W - left - right);

  const py = v =>
    top +
    (ymax - v) / (ymax - ymin) *
    (H - top - bottom);

  const svg = elem('svg', {
    viewBox: '0 0 ' + W + ' ' + H,
    role: 'img',
    'aria-label':
      'Gráfica de voltaje para ' + imei
  });

  // Horizontal grid
  for (let i = 0; i <= 5; i++) {
    const v =
      ymin + (ymax - ymin) * i / 5;

    const y = py(v);

    svg.append(
      elem('line', {
        x1: left,
        x2: W - right,
        y1: y,
        y2: y,
        stroke: '#e8ecf2'
      })
    );

    svg.append(
      elem(
        'text',
        {
          x: 10,
          y: y + 4,
          fill: '#687585',
          'font-size': 13
        },
        v.toFixed(1) + ' V'
      )
    );
  }

  // Reference lines
  for (const [v, color] of [
    [12.6, '#9a9a9a'],
    [13.5, '#9a9a9a']
  ]) {
    svg.append(
      elem('line', {
        x1: left,
        x2: W - right,
        y1: py(v),
        y2: py(v),
        stroke: color,
        'stroke-dasharray': '7 5'
      })
    );
  }

  // Time labels
  for (let i = 0; i <= 5; i++) {
    const t =
      xmin + (xmax - xmin) * i / 5;

    const x = px(t);
    const d = new Date(t);

    svg.append(
      elem(
        'text',
        {
          x: x,
          y: H - bottom + 25,
          'text-anchor': 'middle',
          fill: '#687585',
          'font-size': 12
        },
        d.toISOString()
          .slice(5, 16)
          .replace('T', ' ')
      )
    );
  }

  // Don't connect readings separated by more than 30 min.
  let segment = [];

  function flush() {
    if (segment.length > 1) {
      svg.append(
        elem('polyline', {
          points: segment.join(' '),
          fill: 'none',
          stroke: '#2466a7',
          'stroke-width': 2.4
        })
      );
    }

    segment = [];
  }

  for (let i = 0; i < pts.length; i++) {
    if (
      i > 0 &&
      pts[i][0] - pts[i - 1][0] > 1800000
    ) {
      flush();
    }

    segment.push(
      px(pts[i][0]) + ',' +
      py(pts[i][1])
    );
  }

  flush();

  // Individual measurements
  if (pts.length < 400) {
    for (const p of pts) {
      const c = elem('circle', {
        cx: px(p[0]),
        cy: py(p[1]),
        r: 3.3,
        fill: '#2466a7'
      });

      c.append(
        elem(
          'title',
          {},
          new Date(p[0])
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ') +
          ' UTC | ' +
          p[1].toFixed(2) + ' V'
        )
      );

      svg.append(c);
    }
  }

  chart.replaceChildren(svg);
}

// -----------------------------------------------------
// Render fleet comparison table
// -----------------------------------------------------

function buildTable() {
  rows.replaceChildren();

  const q = search.value.trim();

  for (const s of summary) {
    if (q && !s.imei.includes(q)) {
      continue;
    }

    const tr = document.createElement('tr');

    for (const v of [
      s.imei,
      s.n,
      s.min.toFixed(2),
      s.max.toFixed(2),
      s.avg.toFixed(2),
      s.range.toFixed(2),
      s.low,
      s.high
    ]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(td);
    }

    tr.onclick = () => {
      sel.value = s.imei;
      draw(s.imei);

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    rows.append(tr);
  }
}

sel.addEventListener(
  'change',
  () => draw(sel.value)
);

search.addEventListener(
  'input',
  buildTable
);

buildTable();

if (summary.length) {
  draw(summary[0].imei);
}

</script>
</body>
</html>
`;

  fs.writeFileSync(
    path.join(destination, 'graficas.html'),
    html
  );

  // -----------------------------------------------------
  // 9. Show results
  // -----------------------------------------------------

  console.log('Archivo leído: ' + source);

  console.log(
    'Tramas voltaje: ' + countPackets +
    ' | Asociadas a IMEI: ' + records.length +
    ' | Sin asociación: ' + unmatched
  );

  console.log(
    'Dispositivos: ' + summary.length
  );

  console.log(
    'CSV:  ' +
    path.join(destination, 'voltajes.csv')
  );

  console.log(
    'CSV:  ' +
    path.join(destination, 'resumen.csv')
  );

  console.log(
    'HTML: ' +
    path.join(destination, 'graficas.html')
  );
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
