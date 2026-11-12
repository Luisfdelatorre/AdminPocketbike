import { CommandLog, COMMAND_TYPE, COMMAND_SOURCE, COMMAND_STATUS } from '../models/CommandLog.js';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import dayjs from '../config/dayjs.js';
import logger from '../config/logger.js';

/**
 * Record a command log entry in the database
 */
export const logCommand = async ({
    deviceIdName,
    deviceId,
    gpsId,
    companyId,
    companyName,
    commandType,
    rawCommand,
    source = COMMAND_SOURCE.MANUAL,
    senderName = 'Upay System',
    senderId = null,
    status = COMMAND_STATUS.EXECUTED,
    latencyMs = 0,
    reason = '',
    details = '',
    response = null,
    error = null,
    sentAt = new Date()
}) => {
    try {
        let devName = (deviceIdName || '').trim().toUpperCase();
        let targetCompanyId = companyId;
        let targetCompanyName = companyName;
        let targetDeviceId = deviceId;
        let targetGpsId = gpsId;

        // Populate device details if missing
        if ((!devName || devName === 'N/A' || !targetCompanyId || !targetGpsId) && (targetGpsId || devName)) {
            let query = null;
            if (targetGpsId) {
                const num = Number(targetGpsId);
                query = !isNaN(num) ? { $or: [{ gpsId: num }, { gpsId: String(targetGpsId) }] } : { gpsId: String(targetGpsId) };
            } else if (devName && devName !== 'N/A') {
                query = { name: devName };
            }

            if (query) {
                const devDoc = await Device.findOne(query).lean();
                if (devDoc) {
                    if (!devName || devName === 'N/A') devName = devDoc.name;
                    if (!targetCompanyId) targetCompanyId = devDoc.companyId;
                    if (!targetDeviceId) targetDeviceId = devDoc.deviceId;
                    if (!targetGpsId) targetGpsId = devDoc.gpsId;
                }
            }
        }

        if (targetCompanyId && !targetCompanyName) {
            const compDoc = await Company.findById(targetCompanyId, { name: 1 }).lean();
            if (compDoc) targetCompanyName = compDoc.name;
        }

        // Standardize command type
        let normalizedType = commandType;
        if (!normalizedType && rawCommand) {
            const cmd = String(rawCommand).toLowerCase();
            if (cmd.includes('resume') || cmd === '1') normalizedType = COMMAND_TYPE.RESUME;
            else if (cmd.includes('stop') || cmd === '0') normalizedType = COMMAND_TYPE.STOP;
            else if (cmd.includes('prevent') || cmd.includes('lock')) normalizedType = COMMAND_TYPE.PREVENTIVE;
            else normalizedType = COMMAND_TYPE.STOP;
        }

        const logEntry = await CommandLog.create({
            deviceIdName: devName || 'N/A',
            deviceId: targetDeviceId ? String(targetDeviceId) : null,
            gpsId: targetGpsId ? String(targetGpsId) : null,
            companyId: targetCompanyId || null,
            companyName: targetCompanyName || null,
            commandType: normalizedType || COMMAND_TYPE.STOP,
            rawCommand: rawCommand ? String(rawCommand) : normalizedType,
            source,
            senderName,
            senderId,
            status,
            latencyMs: Math.max(0, Math.round(latencyMs)),
            reason,
            details,
            response,
            error,
            sentAt
        });

        return logEntry;
    } catch (err) {
        logger.error('[commandService.logCommand] Error saving command log:', err.message);
        return null;
    }
};

/**
 * Fetch paginated command logs with period, type and search filters
 */
export const getCommandHistory = async ({
    companyId = null,
    isSuperAdmin = false,
    month = null,
    year = null,
    type = 'ALL',
    search = '',
    page = 1,
    limit = 20
}) => {
    try {
        const query = {};

        if (!isSuperAdmin && companyId) {
            query.companyId = companyId;
        }

        // Date range
        const now = dayjs();
        const targetYear = year ? Number(year) : now.year();
        const targetMonth = month ? Number(month) : now.month() + 1;

        const startOfMonth = dayjs(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01`).startOf('month').toDate();
        const endOfMonth = dayjs(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01`).endOf('month').toDate();

        query.sentAt = { $gte: startOfMonth, $lte: endOfMonth };

        // Type filter (ALL, STOP, RESUME, PREVENTIVE, FAILED, QUEUED)
        const filterTypeUpper = String(type || 'ALL').toUpperCase();
        if (filterTypeUpper === 'STOP') {
            query.commandType = COMMAND_TYPE.STOP;
        } else if (filterTypeUpper === 'RESUME') {
            query.commandType = COMMAND_TYPE.RESUME;
        } else if (filterTypeUpper === 'PREVENTIVE') {
            query.commandType = COMMAND_TYPE.PREVENTIVE;
        } else if (filterTypeUpper === 'FAILED') {
            query.status = COMMAND_STATUS.FAILED;
        } else if (filterTypeUpper === 'QUEUED') {
            query.status = COMMAND_STATUS.QUEUED;
        }

        // Text search
        if (search && search.trim()) {
            const cleanSearch = search.trim();
            query.$or = [
                { deviceIdName: { $regex: cleanSearch, $options: 'i' } },
                { senderName: { $regex: cleanSearch, $options: 'i' } },
                { reason: { $regex: cleanSearch, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [commands, total] = await Promise.all([
            CommandLog.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            CommandLog.countDocuments(query)
        ]);

        return {
            success: true,
            commands,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum) || 1
            }
        };
    } catch (err) {
        logger.error('[commandService.getCommandHistory] Error:', err.message);
        throw err;
    }
};

/**
 * Fetch telemetry metrics and counts for the active period
 */
export const getCommandStats = async ({
    companyId = null,
    isSuperAdmin = false,
    month = null,
    year = null
}) => {
    try {
        const now = dayjs();
        const targetYear = year ? Number(year) : now.year();
        const targetMonth = month ? Number(month) : now.month() + 1;

        const startOfMonth = dayjs(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01`).startOf('month').toDate();
        const endOfMonth = dayjs(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01`).endOf('month').toDate();

        const baseQuery = {
            sentAt: { $gte: startOfMonth, $lte: endOfMonth }
        };
        if (!isSuperAdmin && companyId) {
            baseQuery.companyId = companyId;
        }

        // Previous month for trend calculation
        const prevMonthDate = dayjs(startOfMonth).subtract(1, 'month');
        const startOfPrevMonth = prevMonthDate.startOf('month').toDate();
        const endOfPrevMonth = prevMonthDate.endOf('month').toDate();
        const prevQuery = {
            sentAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth }
        };
        if (!isSuperAdmin && companyId) {
            prevQuery.companyId = companyId;
        }

        const [
            total,
            prevTotal,
            stopCount,
            resumeCount,
            preventiveCount,
            failedCount,
            queuedCount,
            avgLatencyData
        ] = await Promise.all([
            CommandLog.countDocuments(baseQuery),
            CommandLog.countDocuments(prevQuery),
            CommandLog.countDocuments({ ...baseQuery, commandType: COMMAND_TYPE.STOP }),
            CommandLog.countDocuments({ ...baseQuery, commandType: COMMAND_TYPE.RESUME }),
            CommandLog.countDocuments({ ...baseQuery, commandType: COMMAND_TYPE.PREVENTIVE }),
            CommandLog.countDocuments({ ...baseQuery, status: COMMAND_STATUS.FAILED }),
            CommandLog.countDocuments({ ...baseQuery, status: COMMAND_STATUS.QUEUED }),
            CommandLog.aggregate([
                { $match: { ...baseQuery, latencyMs: { $gt: 0 } } },
                { $group: { _id: null, avgLatency: { $avg: '$latencyMs' } } }
            ])
        ]);

        // Calculate trend percentage
        let trendPercent = 0;
        if (prevTotal > 0) {
            trendPercent = Math.round(((total - prevTotal) / prevTotal) * 100);
        }

        // Calculate GPS success rate
        const successfulCount = Math.max(0, total - failedCount);
        const successRate = total > 0 ? Number(((successfulCount / total) * 100).toFixed(1)) : 100;

        // Average latency
        const rawAvgLatency = avgLatencyData?.[0]?.avgLatency || 3400; // default 3.4s
        const latencySeconds = (rawAvgLatency / 1000).toFixed(1);

        return {
            success: true,
            stats: {
                total,
                trendPercent: trendPercent >= 0 ? `+${trendPercent}%` : `${trendPercent}%`,
                successRate: `${successRate}%`,
                latencySeconds: `${latencySeconds}s`,
                queuedCount,
                counts: {
                    all: total,
                    stop: stopCount,
                    resume: resumeCount,
                    preventive: preventiveCount,
                    failed: failedCount
                }
            }
        };
    } catch (err) {
        logger.error('[commandService.getCommandStats] Error:', err.message);
        throw err;
    }
};

export default {
    logCommand,
    getCommandHistory,
    getCommandStats
};

