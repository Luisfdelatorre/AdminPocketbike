import deviceRepository from '../repositories/deviceRepository.js';
import { DeviceAccess } from '../models/DeviceAccess.js';
import { Contract } from '../models/Contract.js';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';

import deviceServices from '../services/deviceServices.js';
import MegaRastreo from '../services/megaRastreoServices1.js';
import { ENGINESTOP, ENGINERESUME } from '../config/config.js';
import bcrypt from 'bcryptjs';

/**
 * Get all devices with status info
 */
const getAllDevices = async (req, res) => {
    try {
        const devices = await Device.find({ isDeleted: { $ne: true } }).sort({ _id: 1 });
        res.json({
            success: true,
            devices
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
        const { companyId } = req.auth;
        let companyConfig = null;
        let company = null;

        if (companyId) {
            company = await Company.findById({ _id: companyId });
            if (company) {
                companyConfig = company.gpsConfig;
                console.log(`[SYNC] Using custom config for company: ${company.name}`);
            }
        }

        const gpsDevices = await MegaRastreo.getDeviceListByCompany(company);
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

/**
 * Assign devices to a company (Bulk Update)
 */
const assignDevicesToCompany = async (req, res) => {
    try {
        const { companyId, deviceIds } = req.body;

        if (!companyId || !Array.isArray(deviceIds)) {
            return res.status(400).json({
                success: false,
                error: 'Company ID and a list of Device IDs are required'
            });
        }

        console.log(`🔗 Assigning ${deviceIds.length} devices to company ${companyId}`);

        // Get Company Name
        const { Company } = await import('../models/Company.js');
        const company = await Company.findById(companyId);

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // 1. Remove devices from this company (if they are NOT in the new list)
        // This effectively "unassigns" devices if they were unchecked
        // BUT, unassigning usually means setting to a default system company or null?
        // For now, checks are "add/keep". If I uncheck a device that WAS assigned,
        // it should probably be removed from this company.
        // STRATEGY:
        // - Set companyId/Name to target for all in deviceIds.
        // - Set companyId/Name to System/Default for all currently in companyId but NOT in deviceIds?
        // Let's implement robust Logic:
        // "Set all these devices to this company".
        // What do we do with devices that *used* to be in this company but are not in the list?
        // If the UI sends "All devices properly assigned to this company", then we should:
        // A. Remove all devices from this company.
        // B. Add the requested devices to this company.
        // However, devices MUST belong to a company. We can't leave them orphan.
        // So, we will only UPDATE the devices in the list.
        // If the user wants to "remove" a device, they should assign it to another company (or System).
        // Let's stick to "Assign these devices to this company".

        // Sanitize IDs (handle potential numbers)
        const sanitizedDeviceIds = deviceIds.map(id => {
            const trimmed = String(id).trim();
            // If it looks like a number, cast to number to match DB types
            return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
        });

        const result = await Device.updateMany(
            { _id: { $in: sanitizedDeviceIds } },
            {
                $set: {
                    companyId: company._id,
                    companyName: company.name
                }
            }
        );


        res.json({
            success: true,
            message: `Updated ${result.modifiedCount} devices to company ${company.name}`,
            data: result
        });

    } catch (error) {
        console.error('Assign devices error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Control device engine (stop/resume)
 */
const controlEngine = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { command } = req.body; // 'stop' or 'resume'
        console.log('Control engine request:', deviceId, command);

        if (command !== 0 && command !== 1) {
            return res.status(400).json({
                success: false,
                error: 'Invalid command. Use "stop" or "resume".'
            });
        }

        const device = await Device.findById(deviceId * 1);
        console.log('Device found:', deviceId, device);
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        const commandType = command === 0 ? ENGINESTOP : ENGINERESUME;

        // Fetch company integration config if available
        let companyConfig = null;
        if (device.companyId) {
            const company = await Company.findById(device.companyId);
            if (company && company.gpsService === 'megarastreo') {
                companyConfig = company.gpsConfig;
                console.log(`[GPS] Using custom config for company: ${company.name}`);
            }
        }

        // Execute and verify via MegaRastreo service
        // We use megaDeviceId (numeric platform ID) for commands
        const success = await MegaRastreo.executeAndVerify(device.megaDeviceId, commandType, {
            companyConfig
        });

        if (success) {
            // Update device status in DB
            device.cutOff = !command;
            await device.save();

            return res.json({
                success: true,
                message: `Engine ${command === 0 ? 'stopped' : 'resumed'} successfully`,
                cutOff: device.cutOff
            });
        } else {
            return res.status(500).json({
                success: false,
                error: `Failed to ${command} engine. Command not confirmed by device.`
            });
        }
    } catch (error) {
        console.error('Control engine error:', error);
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
    syncDevices,
    assignDevicesToCompany,
    controlEngine
};
