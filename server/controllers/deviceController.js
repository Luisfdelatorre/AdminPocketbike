import deviceRepository from '../repositories/deviceRepository.js';
import { DeviceAccess } from '../models/DeviceAccess.js';
import { Contract } from '../models/Contract.js';
import { Device } from '../models/Device.js';

import deviceServices from '../services/deviceServices.js';
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
        // const { deviceIdName } = req.paymentAuth;
        const gpsDevices = await deviceServices.getDeviceList();
        if (gpsDevices.length === 0) {
            return res.json({
                success: true,
                message: 'No devices found to sync',
                stats: { created: 0, updated: 0, errors: 0 }
            });
        }

        const stats = await deviceServices.bulkWriteDevices(gpsDevices);

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
