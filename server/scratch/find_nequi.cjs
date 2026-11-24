const fs = require('fs');
const path = require('path');

function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            walk(p);
        } else if (p.endsWith('.js') || p.endsWith('.jsx')) {
            const content = fs.readFileSync(p, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes("'NEQUI'") || line.includes('"NEQUI"')) {
                    console.log(`${p}:${idx + 1}: ${line.trim()}`);
                }
            });
        }
    });
}

walk('client/src');

