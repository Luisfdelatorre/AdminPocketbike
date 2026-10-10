import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as config from '../config/config.js';
import { connectDatabase } from '../database/connection.js';

// Routes
import usersRoutes from '../routes/usersRoutes.js';
import companiesRoutes from '../routes/companiesRoutes.js';
import authRouter from '../routes/auth.js';
import paymentsRouter from '../routes/paymentsRoutes.js';
import webhooksRouter from '../routes/webhooksRouter.js';
import sseRouter from '../routes/sse.js';
import invoicesRouter from '../routes/invoicesRoutes.js';
import contractsRouter from '../routes/contracts.js';
import dashboardRouter from '../routes/dashboardRouter.js';
import deviceAccessRouter from '../routes/deviceAccess.js';
import devicesRouter from '../routes/devicesRoutes.js';
import companyBillingRouter from '../routes/companyBillingRoutes.js';

import deviceServices from '../services/deviceServices.js';
import seedSuperAdmin from '../utils/seedSuperAdmin.js';
import jobRegistry from '../cron/jobRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.API_PORT || process.env.PORT || 8084;

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
app.use('/apinode/company-invoices', companyBillingRouter);

// Serve uploaded documents
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Health check
app.get('/apinode/health', (req, res) => {
    res.json({
        success: true,
        message: 'API Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Fallback for unhandled API routes
app.use('/apinode/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error in API Server:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: config.server.env === 'development' ? err.message : undefined,
    });
});

// Start server
async function startServer() {
    try {
        await connectDatabase();
        await seedSuperAdmin();
        await jobRegistry.loadJobs();

        app.listen(PORT, async () => {
            console.log('');
            console.log('🚀 Pocketbike API Server Started');
            console.log('================================');
            console.log(`📍 Server: http://localhost:${PORT}`);
            console.log(`🌍 Environment: ${config.server.env}`);
            console.log('================================');

            await deviceServices.initializeGpsUpdates();
        });
    } catch (error) {
        console.error('❌ Failed to start API server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n⏹️ API Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ API Server shutting down gracefully...');
    process.exit(0);
});

startServer();

export default app;
