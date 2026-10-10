import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Patch Vite crypto usage in node chunks
const viteChunksDir = path.resolve(__dirname, '../node_modules/vite/dist/node/chunks');
if (fs.existsSync(viteChunksDir)) {
    const files = fs.readdirSync(viteChunksDir).filter(f => f.startsWith('dep-') && f.endsWith('.js'));
    let cryptoPatched = false;

    files.forEach(file => {
        const filePath = path.join(viteChunksDir, file);
        let content = fs.readFileSync(filePath, 'utf8');

        const originalPattern = /webSocketToken:\s*Buffer\.from\(\s*crypto\$2\.getRandomValues\(new Uint8Array\(9\)\)\s*\)\.toString\("base64url"\)/;
        const replacement = `webSocketToken: Buffer.from(
      (crypto$2.getRandomValues || (crypto$2.webcrypto && crypto$2.webcrypto.getRandomValues))
        ? (crypto$2.getRandomValues || crypto$2.webcrypto.getRandomValues).call(crypto$2.webcrypto || crypto$2, new Uint8Array(9))
        : crypto$2.randomBytes(9)
    ).toString("base64url")`;

        if (originalPattern.test(content)) {
            console.log(`Patching crypto in ${file}...`);
            content = content.replace(originalPattern, replacement);
            fs.writeFileSync(filePath, content, 'utf8');
            cryptoPatched = true;
        } else if (content.includes('crypto$2.randomBytes(9)')) {
            console.log(`${file} crypto is already patched.`);
            cryptoPatched = true;
        }
    });

    if (cryptoPatched) {
        console.log('Successfully verified Vite crypto patch.');
    }
}

// 2. Patch Vite client.mjs to prevent unwanted location.reload() when mobile tab sleeps
const viteClientPath = path.resolve(__dirname, '../node_modules/vite/dist/client/client.mjs');
if (fs.existsSync(viteClientPath)) {
    let clientContent = fs.readFileSync(viteClientPath, 'utf8');

    const reloadPattern = /if\s*\(hasDocument\)\s*\{\s*console\.log\(`\[vite\] server connection lost\. Polling for restart\.\.\.`\);\s*await waitForSuccessfulPing\(protocol, hostAndPath\);\s*location\.reload\(\);\s*\}/;

    const safeReconnect = `if (hasDocument) {
      console.log(\`[vite] server connection lost. Reconnecting without page reload...\`);
      await waitForSuccessfulPing(protocol, hostAndPath);
      try {
        socket = setupWebSocket(protocol, hostAndPath, onCloseWithoutOpen);
      } catch (e) {
        console.warn("[vite] Reconnect failed:", e);
      }
    }`;

    if (reloadPattern.test(clientContent)) {
        clientContent = clientContent.replace(reloadPattern, safeReconnect);
        fs.writeFileSync(viteClientPath, clientContent, 'utf8');
        console.log('Successfully patched Vite client to prevent mobile app switch reload.');
    } else if (clientContent.includes('Reconnecting without page reload')) {
        console.log('Vite client is already patched against mobile reload.');
    } else {
        console.warn('Could not match Vite client reload pattern in client.mjs.');
    }
}
