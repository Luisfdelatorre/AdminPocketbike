import commandService from '../services/commandService.js';
import deviceServices from '../services/deviceServices.js';
import { Device } from '../models/Device.js';
import { COMMAND_SOURCE, COMMAND_TYPE, COMMAND_STATUS } from '../models/CommandLog.js';
import logger from '../config/logger.js';

export const getCommandHistory = async (req, res) => {
    try {
        const { companyId, isSuperAdmin, role, companyName } = req.auth;
        const isSysAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const { month, year, type, search, page, limit } = req.query;

        const result = await commandService.getCommandHistory({
            companyId,
            isSuperAdmin: isSysAdmin,
            month,
            year,
            type,
            search,
            page,
            limit
        });

        res.json(result);
    } catch (error) {
        logger.error('Error in getCommandHistory controller:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getCommandStats = async (req, res) => {
    try {
        const { companyId, isSuperAdmin, role, companyName } = req.auth;
        const isSysAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const { month, year } = req.query;

        const result = await commandService.getCommandStats({
            companyId,
            isSuperAdmin: isSysAdmin,
            month,
            year
        });

        res.json(result);
    } catch (error) {
        logger.error('Error in getCommandStats controller:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const sendCommand = async (req, res) => {
    try {
        const { companyId, username, name, role, companyName, userId } = req.auth;
        const { deviceIdName, command, reason } = req.body;

        const targetDevName = (deviceIdName || '').trim().toUpperCase();
        if (!targetDevName || !command) {
            return res.status(400).json({
                success: false,
                error: 'deviceIdName and command are required'
            });
        }

        const device = await Device.findOne({ name: targetDevName });
        if (!device) {
            return res.status(404).json({
                success: false,
                error: `Device not found: ${targetDevName}`
            });
        }

        const gpsId = device.gpsId;
        if (!gpsId) {
            return res.status(400).json({
                success: false,
                error: `Device ${targetDevName} does not have a configured GPS ID`
            });
        }

        const targetCompanyId = device.companyId || companyId;
        const senderLabel = `${name || username || 'Admin'} (${companyName || 'motos_azvi'})`;
        const startTime = Date.now();

        // Send via device service using vehicle id
        const response = await deviceServices.controlEngine(
            device._id || device.id,
            command,
            targetCompanyId
        );

        const latencyMs = Date.now() - startTime;
        const isSuccess = response && response.success;

        // Determine command type enum
        let commandType = COMMAND_TYPE.STOP;
        if (command.toLowerCase().includes('resume')) commandType = COMMAND_TYPE.RESUME;
        else if (command.toLowerCase().includes('prevent') || command.toLowerCase().includes('lock')) commandType = COMMAND_TYPE.PREVENTIVE;

        // Log entry
        await commandService.logCommand({
            deviceIdName: device.name,
            deviceId: device.deviceId,
            gpsId: String(gpsId),
            companyId: targetCompanyId,
            companyName: companyName || device.companyName,
            commandType,
            rawCommand: command,
            source: COMMAND_SOURCE.MANUAL,
            senderName: senderLabel,
            senderId: userId || null,
            status: isSuccess ? COMMAND_STATUS.EXECUTED : COMMAND_STATUS.FAILED,
            latencyMs,
            reason: reason || 'Acción manual desde portal de comandos',
            response: response || null,
            error: response?.error || null
        });

        if (isSuccess) {
            return res.json(response);
        } else {
            return res.status(500).json({
                success: false,
                error: response?.error || 'Failed to execute engine command'
            });
        }
    } catch (error) {
        logger.error('Error in sendCommand controller:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export default {
    getCommandHistory,
    getCommandStats,
    sendCommand
};

