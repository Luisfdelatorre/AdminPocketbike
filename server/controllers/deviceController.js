import { Device } from '../models/Device.js';
import { DeviceAccess } from '../models/DeviceAccess.js';
import { Contract } from '../models/Contract.js';
import gpsService from '../services/gpsService.js';
import bcrypt from 'bcryptjs';

/**
 * Get all devices with status info
 */
const getAllDevices = async (req, res) => {
    try {
        const devices = await Device.find({ isDeleted: { $ne: true } }).sort({ _id: 1 });

        // Get PIN status and active contracts for each device
        const devicesWithStatus = await Promise.all(devices.map(async (device) => {
            const hasPin = await DeviceAccess.findOne({ deviceId: device._id, isActive: true });
            const activeContract = await Contract.findOne({
                deviceId: device._id,
                status: 'ACTIVE'
            });

            return {
                ...device.toObject(),
                hasPin: !!hasPin,
                hasActiveContract: !!activeContract,
                activeContractId: activeContract?.contractId || null
            };
        }));

        res.json({
            success: true,
            devices: devicesWithStatus
        });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Create a new device
 */
const createDevice = async (req, res) => {
    try {
        const {
            _id,
            deviceName,
            nequiNumber,
            simCardNumber,
            isActive = true,
            notes = ''
        } = req.body;

        if (!_id || !deviceName) {
            return res.status(400).json({
                success: false,
                error: '_id and deviceName are required'
            });
        }

        const device = await Device.create({
            _id,
            deviceName,
            nequiNumber,
            simCardNumber,
            isActive,
            status: isActive ? 'active' : 'inactive',
            notes
        });

        res.json({
            success: true,
            device
        });
    } catch (error) {
        console.error('Create device error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update device information
 */
const updateDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const {
            deviceName,
            nequiNumber,
            simCardNumber,
            isActive,
            status,
            notes,
            model,
            serialNumber
        } = req.body;

        const device = await Device.findById(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // Update fields
        if (deviceName !== undefined) device.deviceName = deviceName;
        if (nequiNumber !== undefined) device.nequiNumber = nequiNumber;
        if (simCardNumber !== undefined) device.simCardNumber = simCardNumber;
        if (isActive !== undefined) {
            device.isActive = isActive;
            device.status = isActive ? 'active' : 'inactive';
        }
        if (status !== undefined) device.status = status;
        if (notes !== undefined) device.notes = notes;
        if (model !== undefined) device.model = model;
        if (serialNumber !== undefined) device.serialNumber = serialNumber;

        await device.save();

        res.json({
            success: true,
            device
        });
    } catch (error) {
        console.error('Update device error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Delete a device (soft delete - set inactive)
 */
const deleteDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        console.log(`🗑️ Request to delete device: ${deviceId}`);

        const device = await Device.findById(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // Check if device has active contract
        const activeContract = await Contract.findOne({
            deviceId: device._id,
            status: 'ACTIVE'
        });

        if (activeContract) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete device with active contract. Cancel contract first.'
            });
        }

        // Soft delete - set inactive and deleted flag
        device.isActive = false;
        device.status = 'inactive';
        device.isDeleted = true;
        await device.save();

        res.json({
            success: true,
            message: 'Device deactivated successfully'
        });
    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Sync devices from GPS platform
 */
const syncDevices = async (req, res) => {
    try {
        console.log('🔄 Syncing devices from GPS platform...');

        // This relies on gpsService being configured with credentials in .env
        const gpsDevices = await gpsService.fetchDevices();
        console.log(`📡 Fetched ${gpsDevices.length} devices from GPS.`);

        if (gpsDevices.length === 0) {
            return res.json({
                success: true,
                message: 'No devices found to sync',
                stats: { created: 0, updated: 0, errors: 0 }
            });
        }

        // Prepare bulk operations for Devices
        const deviceOps = gpsDevices.map(d => {
            const mapped = {
                _id: d.id, // Map "id" to internal "gpsId"
                deviceName: d.name,
                nequiNumber: d.phone,
                simCardNumber: d.contact,
                model: d.model,
                groupId: d.groupId,
                isActive: !d.disabled,
                status: d.disabled ? 'inactive' : 'active'
            };

            return {
                updateOne: {
                    filter: { _id: d.id },
                    update: { $set: mapped },
                    upsert: true
                }
            };
        });

        // Prepare bulk operations for DeviceAccess (PINs)
        const accessOpsPromises = gpsDevices.map(async d => {
            if (!d.phone) return null;

            const cleanPhone = d.phone.replace(/\D/g, '');
            const pin = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : null;

            if (!pin) return null;

            // Manually hash because bulkWrite bypasses mongoose hooks
            const salt = await bcrypt.genSalt(10);
            const pinHash = await bcrypt.hash(pin, salt);

            return {
                updateOne: {
                    filter: { deviceId: d.id, isActive: true },
                    update: {
                        $set: { pinHash: pinHash },
                        $setOnInsert: {
                            deviceId: d.id,
                            accessType: 'permanent',
                            isActive: true
                        }
                    },
                    upsert: true
                }
            };
        });

        const accessOps = (await Promise.all(accessOpsPromises)).filter(op => op !== null);

        // Execute bulk writes in parallel
        const [deviceResult, accessResult] = await Promise.all([
            Device.bulkWrite(deviceOps),
            accessOps.length > 0 ? DeviceAccess.bulkWrite(accessOps) : Promise.resolve({ upsertedCount: 0, modifiedCount: 0 })
        ]);

        const stats = {
            created: deviceResult.upsertedCount,
            updated: deviceResult.modifiedCount,
            pinUpdates: accessResult.modifiedCount + accessResult.upsertedCount,
            errors: 0
        };

        res.json({
            success: true,
            message: `Sync complete. Devices: ${stats.created} new, ${stats.updated} updated. PINs: ${stats.pinUpdates} synced.`,
            stats
        });

    } catch (error) {
        console.error('Sync devices error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default {
    getAllDevices,
    createDevice,
    updateDevice,
    deleteDevice,
    syncDevices
};
