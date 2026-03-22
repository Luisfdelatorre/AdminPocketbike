// polyfills-file.js
// Preloaded before app code. Ensures global File exists for undici/webidl.

// Try undici first
if (!globalThis.File) {
    try {
        const { File } = await import("undici");
        if (File) globalThis.File = File;
    } catch (_) { }
}

// Fallback to fetch-blob
if (!globalThis.File) {
    try {
        const { File } = await import("fetch-blob/file.js");
        globalThis.File = File;
    } catch (e) {
        console.error(
            "File polyfill failed. Install fetch-blob: npm i fetch-blob\n",
            e
        );
        process.exit(1);
    }
}
