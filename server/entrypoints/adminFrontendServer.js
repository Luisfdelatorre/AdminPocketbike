import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.ADMIN_FRONTEND_PORT || 8088;

const app = express();

// Request logging
app.use((req, res, next) => {
    console.log(`[ADMIN FRONTEND SERVER] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

const distPath = path.join(__dirname, '../../dist');
const API_PORT = process.env.API_PORT || 8084;
const API_SERVER_URL = process.env.API_SERVER_URL || `http://127.0.0.1:${API_PORT}`;

// Proxy /apinode and /api requests to API.PocketBike (port 8084)
app.use(['/apinode', '/api'], async (req, res) => {
    try {
        const targetUrl = `${API_SERVER_URL}${req.originalUrl}`;
        const headers = { ...req.headers };
        delete headers.host;

        const options = {
            method: req.method,
            headers,
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            options.body = req;
            options.duplex = 'half';
        }

        const fetchRes = await fetch(targetUrl, options);
        res.status(fetchRes.status);
        fetchRes.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });
        const arrayBuffer = await fetchRes.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error('[ADMIN FRONTEND PROXY ERROR]:', err);
        res.status(502).json({ success: false, error: 'API Server unavailable' });
    }
});

// Static assets from dist
app.use(express.static(distPath));

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Admin.Frontend',
        timestamp: new Date().toISOString(),
    });
});

// SPA fallback for all non-asset requests
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found. Please run "npm run build".');
    }
});

app.listen(PORT, () => {
    console.log('');
    console.log('🚀 Admin Frontend Server Started');
    console.log('================================');
    console.log(`📍 Web App: http://localhost:${PORT}`);
    console.log(`📂 Serving: ${distPath}`);
    console.log('================================');
});

process.on('SIGINT', () => {
    console.log('\n⏹️ Admin Frontend Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ Admin Frontend Server shutting down gracefully...');
    process.exit(0);
});

export default app;
