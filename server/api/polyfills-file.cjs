// polyfills-file.cjs
// Preloaded before app code. Ensures global File exists for undici/webidl.
try {
    // Many undici builds export File
    const { File } = require("undici");
    if (!globalThis.File && File) globalThis.File = File;
} catch (_) { }

if (!globalThis.File) {
    // Fallback polyfill
    try {
        const { File } = require("fetch-blob/file.js");
        globalThis.File = File;
    } catch (e) {
        console.error(
            "File polyfill failed. Install fetch-blob: npm i fetch-blob\n",
            e
        );
        process.exit(1);
    }
}
