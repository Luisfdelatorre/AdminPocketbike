const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync('server/scratch/reporte-voltajes/secuencias_con_estado_y_velocidad.json', 'utf8'));

// Find all sequences where a vehicle is running continuously (>= 3 consecutive samples)
// and check the slope dV/dt (is it negative? strictly decreasing? stagnant?)
const candidates = [];

for (const [imei, samples] of Object.entries(data)) {
  let currentRun = [];
  const runs = [];

  for (const s of samples) {
    const isRunning = s.ignition || s.moving || s.speed > 0;
    if (isRunning) {
      currentRun.push(s);
    } else {
      if (currentRun.length >= 3) {
        runs.push([...currentRun]);
      }
      currentRun = [];
    }
  }
  if (currentRun.length >= 3) {
    runs.push([...currentRun]);
  }

  for (const run of runs) {
    const voltages = run.map(r => r.voltage);
    const maxV = Math.max(...voltages);
    const minV = Math.min(...voltages);
    const delta = voltages[voltages.length - 1] - voltages[0];
    
    // Check if alternator is failing:
    // 1. Max voltage never reaches 13.2V
    // 2. Voltage slope is <= 0 (it is dropping or strictly stagnant)
    if (maxV <= 13.0) {
      candidates.push({
        imei,
        length: run.length,
        durationMin: Math.round((new Date(run[run.length - 1].time) - new Date(run[0].time)) / 60000),
        vStart: voltages[0],
        vEnd: voltages[voltages.length - 1],
        delta: +delta.toFixed(2),
        voltages,
        times: run.map(r => r.time)
      });
    }
  }
}

console.log('Continuous Runs with Alternator Failure (maxV <= 13.0V):');
console.log(JSON.stringify(candidates, null, 2));

