import express from 'express';
import usersRoutes from './routes/usersRoutes.js';
import companiesRoutes from './routes/companiesRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import * as config from './config/config.js';
import { connectDatabase } from './database/connection.js';

// Routes
import authRouter from './routes/auth.js';
import paymentsRouter from './routes/paymentsRoutes.js';
import webhooksRouter from './routes/webhooksRouter.js';
import sseRouter from './routes/sse.js';
import deviceServices from './services/deviceServices.js';

import invoicesRouter from './routes/invoicesRoutes.js';
import contractsRouter from './routes/contracts.js';
import dashboardRouter from './routes/dashboardRouter.js';
import deviceAccessRouter from './routes/deviceAccess.js';
import devicesRouter from './routes/devicesRoutes.js';
import paymentPageRouter from './routes/paymentPageRoutes.js';
import cron from "./cron-server/cron.js";
const { default: seedSuperAdmin } = await import('./utils/seedSuperAdmin.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8083;

const app = express();

// Middleware - Increase limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/apinode/users', usersRoutes);
app.use('/apinode/companies', companiesRoutes);
app.use('/apinode/auth', authRouter);
app.use('/apinode/payments', paymentsRouter);
app.use('/apinode/webhooks', webhooksRouter);
app.use('/apinode/sse', sseRouter);
app.use('/apinode/invoices', invoicesRouter);
app.use('/apinode/contracts', contractsRouter);
app.use('/apinode/dashboard', dashboardRouter);
app.use('/apinode/device-access', deviceAccessRouter);
app.use('/apinode/devices', devicesRouter);


// Serve static files from dist directory (Production Build) - PRIORITY
app.use(express.static(path.join(__dirname, '../dist')));

// Custom Payment Page (Vanilla JS)
// Serve static assets for the custom page
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/css', express.static(path.join(__dirname, '../client/css')));
// Serve static assets from dist root for the payment page (images are now in dist root)
app.use(express.static(path.join(__dirname, '../dist')));

// Custom Payment Route - Use router for better organization
app.use('/p', paymentPageRouter);

// Health check
app.get('/apinode/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Serve static files from dist directory (Moved to top)

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
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

        // Seed Super Admin

        await seedSuperAdmin();
        await cron.init();
        //execute cron jobs
        await cron.execute('dailyInvoicesCreation');

        // Start Express server
        app.listen(config.server.port, async () => {
            console.log('');
            console.log('🚀 Payments-Wompi Server Started');
            console.log('================================');
            console.log(`📍 Server: http://localhost:${config.server.port}`);
            console.log(`🌍 Environment: ${config.server.env}`);
            console.log(`💳 Wompi API: ${config.Url.WompiBaseUrl}`);
            console.log('================================');
            console.log('');
            console.log('================================');
            console.log('');

            // Start MegaRastreo Auto Update via Device Service
            //await deviceServices.initializeGpsUpdates();
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
