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
