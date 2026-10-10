import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [react(), basicSsl()],
    root: './client',
    publicDir: 'public',
    server: {
        host: true, // Enable network access
        port: 5173,
        proxy: {
            '/apinode': {
                target: 'http://127.0.0.1:8084',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', (err) => {
                        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
                        console.error('[vite-proxy] Error:', err.message);
                    });
                }
            },
            '/p': {
                target: 'http://127.0.0.1:8084',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', (err) => {
                        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
                        console.error('[vite-proxy] Error:', err.message);
                    });
                }
            },
            '/uploads': {
                target: 'http://127.0.0.1:8084',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', (err) => {
                        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
                        console.error('[vite-proxy] Error:', err.message);
                    });
                }
            },
        },
    },
    preview: {
        port: 4173,
        proxy: {
            '/apinode': {
                target: 'http://127.0.0.1:8084',
                changeOrigin: true,
            },
            '/p': {
                target: 'http://127.0.0.1:8084',
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://127.0.0.1:8084',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'client/index.html'),
                payment: resolve(__dirname, 'client/pay/index.html'),
            },
        },
    },
});
