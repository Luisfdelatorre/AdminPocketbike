import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/config.js';
import { connectDatabase } from './database/connection.js';

// Routes
import authRouter from './routes/auth.js';
import paymentsRouter from './routes/payments.js';
import webhooksRouter from './routes/webhooks.js';
import sseRouter from './routes/sse.js';
import invoicesRouter from './routes/invoices.js';
import contractsRouter from './routes/contracts.js';
import dashboardRouter from './routes/dashboard.js';
import deviceAccessRouter from './routes/deviceAccess.js';
import devicesRouter from './routes/devices.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature, x-timestamp');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/sse', sseRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/device-access', deviceAccessRouter);
app.use('/api/devices', devicesRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../client/index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: config.server.env === 'development' ? err.message : undefined,
    });
});

// Start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectDatabase();

        // Clean up deprecated index
        try {
            const { Device } = await import('./models/Device.js');
            await Device.collection.dropIndex('deviceId_1');
            console.log('🧹 Deprecated index deviceId_1 dropped.');
        } catch (e) {
            // Ignore if index not found
        }

        // Start Express server
        app.listen(config.server.port, () => {
            console.log('');
            console.log('🚀 Payments-Wompi Server Started');
            console.log('================================');
            console.log(`📍 Server: http://localhost:${config.server.port}`);
            console.log(`🌍 Environment: ${config.server.env}`);
            console.log(`💳 Wompi API: ${config.wompi.apiUrl}`);
            console.log('================================');
            console.log('');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️  Shutting down gracefully...');
    process.exit(0);
});

startServer();

export default app;
