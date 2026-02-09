import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    root: './client',
    server: {
        host: true, // Enable network access
        port: 5173,
        proxy: {
            '/apinode': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
            },
            '/pagos': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
            },
        },
    },
    preview: {
        port: 4173,
        proxy: {
            '/apinode': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
            },
            '/pagos': {
                target: 'http://127.0.0.1:3000',
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
