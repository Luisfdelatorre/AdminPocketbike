import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as config from '../config/config.js';
import { connectDatabase } from '../database/connection.js';
import paymentPageRouter from '../routes/paymentPageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PAY_USER_PORT || 8087;

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`[PAY USER SERVER] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static assets for the custom payment page
app.use('/js', express.static(path.join(__dirname, '../../client/js')));
app.use('/css', express.static(path.join(__dirname, '../../client/css')));
app.use(express.static(path.join(__dirname, '../../dist')));

// Custom Payment Route (/p/:plate)
app.use('/p', paymentPageRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Pagos.User',
        timestamp: new Date().toISOString(),
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error in Pay User Server:', err);
    res.status(500).json({
        success: false,
        error: 'Pay User Server Error',
        message: config.server.env === 'development' ? err.message : undefined,
    });
});

async function startServer() {
    try {
        await connectDatabase();
        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 Pay User Server Started');
            console.log('================================');
            console.log(`📍 Server: http://localhost:${PORT}`);
            console.log(`💳 Route: /p/:plate`);
            console.log('================================');
        });
    } catch (error) {
        console.error('❌ Failed to start Pay User server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n⏹️ Pay User Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ Pay User Server shutting down gracefully...');
    process.exit(0);
});

startServer();

export default app;
