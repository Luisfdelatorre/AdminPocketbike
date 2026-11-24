const fs = require('node:fs');
const content = fs.readFileSync('client/src/pages/AdminDashboard.css', 'utf8');
const lines = content.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<<<<<<<') || lines[i].includes('=======') || lines[i].includes('>>>>>>>')) {
    console.log(i, lines[i]);
  }
}

