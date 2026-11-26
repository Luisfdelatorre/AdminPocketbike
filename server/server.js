import './utils/polyfillFetch.js';
import 'dotenv/config';
import express from 'express';
import usersRoutes from './routes/usersRoutes.js';
import companiesRoutes from './routes/companiesRoutes.js';
import path from 'path';
import fs from 'fs';
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
import companyBillingRouter from './routes/companyBillingRoutes.js';
import reportTemplatesRouter from './routes/reportTemplatesRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import systemJobsRoutes from './routes/systemJobsRoutes.js';
import commandsRouter from './routes/commandsRoutes.js';
import alertsRouter from './routes/alertsRoutes.js';
import assistantRouter from './routes/assistantRoutes.js';
import { attachAssistantWebSocketServer } from './ws/assistantWsServer.js';
import cron from "./cron-server/cron.js";
import jobRegistry from "./cron-server/jobRegistry.js";
import syncDailyKm, { syncYesterdayKm } from './cron-server/jobs/syncDailyKm.js';
const { default: seedSuperAdmin } = await import('./utils/seedSuperAdmin.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8083;

const app = express();

// Middleware - Increase limit for base64 image uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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

import settingsRoutes from './routes/settingsRoutes.js';

// API Routes (mounted on both /api/v1 and /apinode for full compatibility)
['/api/v1', '/apinode'].forEach(prefix => {
    app.use(`${prefix}/users`, usersRoutes);
    app.use(`${prefix}/companies`, companiesRoutes);
    app.use(`${prefix}/auth`, authRouter);
    app.use(`${prefix}/payments`, paymentsRouter);
    app.use(`${prefix}/webhooks`, webhooksRouter);
    app.use(`${prefix}/sse`, sseRouter);
    app.use(`${prefix}/invoices`, invoicesRouter);
    app.use(`${prefix}/contracts`, contractsRouter);
    app.use(`${prefix}/dashboard`, dashboardRouter);
    app.use(`${prefix}/device-access`, deviceAccessRouter);
    app.use(`${prefix}/devices`, devicesRouter);
    app.use(`${prefix}/company-invoices`, companyBillingRouter);
    app.use(`${prefix}/report-templates`, reportTemplatesRouter);
    app.use(`${prefix}/cron`, cronRoutes);
    app.use(`${prefix}/system-jobs`, systemJobsRoutes);
    app.use(`${prefix}/settings`, settingsRoutes);
    app.use(`${prefix}/commands`, commandsRouter);
    app.use(`${prefix}/alerts`, alertsRouter);
    app.use(`${prefix}/assistant`, assistantRouter);
    app.use(`${prefix}/ai`, assistantRouter);
});

// Serve uploaded documents
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static files from dist directory (Production Build) - PRIORITY
app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.static(path.join(__dirname, '../client/public')));

// Custom Payment Page (Vanilla JS)
// Serve static assets for the custom page
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/css', express.static(path.join(__dirname, '../client/css')));
// Serve static assets from dist root for the payment page (images are now in dist root)
app.use(express.static(path.join(__dirname, '../dist')));

// Custom Payment Route - Use router for better organization
app.use('/p', paymentPageRouter);

// Health check
app.get(['/api/v1/health', '/apinode/health', '/health'], async (req, res) => {
    try {
        const method = (req.query.method || req.query.mode || req.query.sync || 'daily').toLowerCase();
        const targetDate = req.query.date ? new Date(req.query.date) : new Date();
        let kmResult = null;

        if (method === 'yesterday') {
            const yesterdayFn = syncYesterdayKm?.run || (typeof syncYesterdayKm === 'function' ? syncYesterdayKm : null);
            if (typeof yesterdayFn === 'function') {
                kmResult = await yesterdayFn(targetDate);
            }
        } else {
            const runFn = syncDailyKm?.run || syncDailyKm?.syncDailyKm || (typeof syncDailyKm === 'function' ? syncDailyKm : null);
            if (typeof runFn === 'function') {
                kmResult = await runFn(targetDate);
            }
        }

        res.json({
            success: true,
            message: 'Server is running',
            executedMethod: method,
            date: targetDate.toISOString(),
            kmResult,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error(`Error running km sync (${req.query.method || 'daily'}):`, err);
        res.status(500).json({
            success: false,
            message: 'Error running km sync',
            error: err.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/apinode')) {
        const indexPath = path.join(__dirname, '../dist/index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).json({
                error: 'Frontend build not found',
                message: 'dist/index.html does not exist. Please run "npm run build" or use Vite dev server on port 5173.'
            });
        }
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
        // await cron.init();
        //execute cron jobs
        // await cron.execute('dailyInvoicesCreation');

        // Load plugins into memory for the API endpoints
        await jobRegistry.loadJobs();

        // Start Express server
        const httpServer = app.listen(config.server.port, async () => {
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
            await deviceServices.initializeGpsUpdates();
        });
        attachAssistantWebSocketServer(httpServer);
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
