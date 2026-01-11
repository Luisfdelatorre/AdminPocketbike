import { DeviceAccess } from '../models/DeviceAccess.js';

/**
 * Create or update PIN for a device
 */
const createDeviceAccess = async (req, res) => {
    try {
        const { deviceId, pin, accessType = 'permanent' } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                error: 'deviceId is required'
            });
        }

        // Generate 4-digit PIN if not provided
        const devicePin = pin || Math.floor(1000 + Math.random() * 9000).toString();

        // Check if device already has access
        const existing = await DeviceAccess.findOne({ deviceId, isActive: true });

        if (existing) {
            // Update existing
            existing.pinHash = devicePin; // Will be hashed by pre-save hook
            existing.accessType = accessType;
            await existing.save();

            return res.json({
                success: true,
                message: 'Device PIN updated',
                data: {
                    deviceId,
                    pin: devicePin, // Return plain PIN for admin to see
                    accessType: existing.accessType
                }
            });
        }

        // Create new
        const deviceAccess = await DeviceAccess.create({
            deviceId,
            pinHash: devicePin, // Will be hashed by pre-save hook
            accessType,
            isActive: true
        });

        res.json({
            success: true,
            message: 'Device PIN created',
            data: {
                deviceId,
                pin: devicePin, // Return plain PIN for admin to see
                accessType: deviceAccess.accessType
            }
        });
    } catch (error) {
        console.error('Create device access error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get device access info (without PIN)
 */
const getDeviceAccess = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const access = await DeviceAccess.findOne({ deviceId, isActive: true });

        if (!access) {
            return res.json({
                success: true,
                hasPin: false,
                data: null
            });
        }

        res.json({
            success: true,
            hasPin: true,
            data: {
                deviceId: access.deviceId,
                accessType: access.accessType,
                createdAt: access.createdAt,
                lastUsed: access.lastUsed,
                usedCount: access.usedCount
            }
        });
    } catch (error) {
        console.error('Get device access error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Deactivate device access
 */
const deactivateDeviceAccess = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const access = await DeviceAccess.findOne({ deviceId, isActive: true });

        if (!access) {
            return res.status(404).json({
                success: false,
                error: 'Device access not found'
            });
        }

        access.isActive = false;
        await access.save();

        res.json({
            success: true,
            message: 'Device access deactivated'
        });
    } catch (error) {
        console.error('Delete device access error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default {
    createDeviceAccess,
    getDeviceAccess,
    deactivateDeviceAccess
};
