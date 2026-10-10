import 'dotenv/config';
import express from 'express';
import * as config from '../config/config.js';
import { connectDatabase } from '../database/connection.js';
import webhookController from '../controllers/webhookController.js';
import { validateWompiSignature } from '../middleware/wompiMiddleware.js';

const PORT = process.env.WEBHOOK_PORT || 8085;
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature, x-timestamp');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`[WEBHOOK SERVER] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Wompi Webhook endpoints
// Dominio esperado: https://webhook.pocketbike.app/payments/wompi
app.post('/payments/wompi', validateWompiSignature, webhookController.handleWompiWebhook);

// Compatibilidad previa
app.post('/apinode/webhooks/wompi', validateWompiSignature, webhookController.handleWompiWebhook);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Webhook.Wompi',
        timestamp: new Date().toISOString(),
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error in Webhook Server:', err);
    res.status(500).json({
        success: false,
        error: 'Webhook Server Error',
        message: config.server.env === 'development' ? err.message : undefined,
    });
});

async function startServer() {
    try {
        await connectDatabase();
        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 Wompi Webhook Server Started');
            console.log('================================');
            console.log(`📍 Listener: http://localhost:${PORT}`);
            console.log(`💳 Endpoint: /payments/wompi`);
            console.log('================================');
        });
    } catch (error) {
        console.error('❌ Failed to start Webhook server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n⏹️ Webhook Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ Webhook Server shutting down gracefully...');
    process.exit(0);
});

startServer();

export default app;
