import express from 'express';
import authController from '../controllers/authController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new admin user (requires existing admin)
 */
router.post('/register', authenticate, requireAdmin, authController.register);

/**
 * POST /api/auth/login
 * Admin login with email/password
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/device-pin
 * Verify device PIN and get access token
 */
router.post('/device-pin', authController.verifyDevicePin);

/**
 * POST /api/auth/create-device-pin
 * Create a new device PIN (admin only)
 */
router.post('/create-device-pin', authenticate, requireAdmin, authController.createDevicePin);

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, authController.getMe);

/**
 * POST /api/auth/verify-token
 * Verify if token is still valid
 */
router.post('/verify-token', authController.verifyToken);

export default router;
