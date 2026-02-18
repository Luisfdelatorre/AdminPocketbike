const fs = require('fs');
const path = require('path');

const viteChunksDir = path.resolve(__dirname, '../node_modules/vite/dist/node/chunks');

if (!fs.existsSync(viteChunksDir)) {
    console.log('Vite chunks directory not found. Skipping patch.');
    process.exit(0);
}

const files = fs.readdirSync(viteChunksDir).filter(f => f.startsWith('dep-') && f.endsWith('.js'));

let patched = false;

files.forEach(file => {
    const filePath = path.join(viteChunksDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Original crashing code pattern
    const originalPattern = /webSocketToken:\s*Buffer\.from\(\s*crypto\$2\.getRandomValues\(new Uint8Array\(9\)\)\s*\)\.toString\("base64url"\)/;

    // Replacement code using randomBytes fallback
    const replacement = `webSocketToken: Buffer.from(
      (crypto$2.getRandomValues || (crypto$2.webcrypto && crypto$2.webcrypto.getRandomValues))
        ? (crypto$2.getRandomValues || crypto$2.webcrypto.getRandomValues).call(crypto$2.webcrypto || crypto$2, new Uint8Array(9))
        : crypto$2.randomBytes(9)
    ).toString("base64url")`;

    if (originalPattern.test(content)) {
        console.log(`Patching ${file}...`);
        content = content.replace(originalPattern, replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        patched = true;
    } else if (content.includes('crypto$2.randomBytes(9)')) {
        console.log(`${file} is already patched.`);
        patched = true;
    }
});

if (patched) {
    console.log('Successfully patched Vite crypto usage.');
} else {
    console.log('No matching Vite chunk found to patch or pattern changed.');
}
