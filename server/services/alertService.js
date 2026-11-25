import { AlertLog, ALERT_TYPE, ALERT_SEVERITY, ALERT_STATUS } from '../models/AlertLog.js';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import { sseService } from '../utils/sseService.js';
import dayjs from '../config/dayjs.js';
import logger from '../config/logger.js';

// Cooldown window in minutes to prevent flooding duplicate alerts for the same device
const DEDUPLICATION_COOLDOWN_MINUTES = {
    [ALERT_TYPE.UNAUTHORIZED_DRIVING]: 15,
    [ALERT_TYPE.POWER_CUT]: 20,
    [ALERT_TYPE.UNAUTHORIZED_MOVEMENT]: 30,
    [ALERT_TYPE.UNAUTHORIZED_IGNITION]: 15,
    [ALERT_TYPE.GEOFENCE_EXIT]: 30,
    [ALERT_TYPE.EXTENDED_OFFLINE]: 120
};

// In-memory 30-minute summary buffer for UNAUTHORIZED_MOVEMENT:
// Minute 0: inserts 1 document in MongoDB + broadcasts SSE.
// Minutes 0-30: 0 MongoDB writes; accumulates count/maxSpeed/location in RAM + broadcasts live SSE.
// Minute 30 (or on status change): 1 single updateOne with the final interval summary.
const MOVEMENT_SUMMARY_WINDOW_MS = DEDUPLICATION_COOLDOWN_MINUTES[ALERT_TYPE.UNAUTHORIZED_MOVEMENT] * 60 * 1000;
const MOVEMENT_SSE_THROTTLE_MS = 2500;
const movementSummaryBuffers = new Map();

const getMovementBufferKey = (devName) => `${devName}_${ALERT_TYPE.UNAUTHORIZED_MOVEMENT}`;

const flushMovementBuffer = async (bufferKey) => {
    const entry = movementSummaryBuffers.get(bufferKey);
    if (!entry) return;

    movementSummaryBuffers.delete(bufferKey);
    if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
    }

    if (!entry.dirty) return;

    try {
        await AlertLog.updateOne(
            { _id: entry.alertId },
            {
                $set: {
                    occurrenceCount: entry.occurrenceCount,
                    lastSeenAt: entry.lastSeenAt,
                    location: entry.alertSnapshot.location,
                    metadata: entry.alertSnapshot.metadata
                }
            }
        );
        logger.info(`[AlertService] 📦 Flushed movement summary for ${entry.alertSnapshot.deviceIdName} (x${entry.occurrenceCount}, max ${Math.round(entry.maxSpeed)} km/h)`);
    } catch (err) {
        logger.error(`[AlertService] Error flushing movement summary buffer (${bufferKey}):`, err);
    }
};

const registerMovementBuffer = (alertDoc, companyId) => {
    const snapshot = typeof alertDoc.toObject === 'function' ? alertDoc.toObject() : { ...alertDoc };
    const bufferKey = getMovementBufferKey(snapshot.deviceIdName);
    const existing = movementSummaryBuffers.get(bufferKey);
    if (existing?.timer) {
        clearTimeout(existing.timer);
    }

    const now = Date.now();
    const initialSpeed = snapshot.location?.speed ?? 0;
    const entry = {
        alertId: snapshot._id,
        companyId: companyId ?? snapshot.companyId,
        windowExpiresAt: now + MOVEMENT_SUMMARY_WINDOW_MS,
        occurrenceCount: snapshot.occurrenceCount || 1,
        maxSpeed: Math.max(initialSpeed, snapshot.metadata?.maxSpeed ?? 0),
        lastSeenAt: snapshot.lastSeenAt || snapshot.timestamp || new Date(),
        lastSseBroadcastAt: now,
        dirty: false,
        alertSnapshot: {
            ...snapshot,
            metadata: {
                ...(snapshot.metadata || {}),
                maxSpeed: Math.max(initialSpeed, snapshot.metadata?.maxSpeed ?? 0),
                firstLocation: snapshot.metadata?.firstLocation || (
                    snapshot.location?.latitude && snapshot.location?.longitude
                        ? { latitude: snapshot.location.latitude, longitude: snapshot.location.longitude }
                        : null
                )
            }
        },
        timer: setTimeout(() => {
            flushMovementBuffer(bufferKey);
        }, MOVEMENT_SUMMARY_WINDOW_MS)
    };

    if (typeof entry.timer.unref === 'function') {
        entry.timer.unref();
    }

    movementSummaryBuffers.set(bufferKey, entry);
    return entry;
};

const overlayActiveMovementBuffers = (alerts = []) => {
    if (!movementSummaryBuffers.size || !Array.isArray(alerts)) return alerts;
    return alerts.map((a) => {
        if (a.alertType !== ALERT_TYPE.UNAUTHORIZED_MOVEMENT) return a;
        const entry = movementSummaryBuffers.get(getMovementBufferKey(a.deviceIdName));
        if (entry && String(entry.alertId) === String(a._id)) {
            return {
                ...a,
                occurrenceCount: entry.occurrenceCount,
                lastSeenAt: entry.lastSeenAt,
                location: entry.alertSnapshot.location,
                metadata: entry.alertSnapshot.metadata
            };
        }
        return a;
    });
};

/**
 * Record or aggregate an alert in the database
 */
export const recordAlert = async ({
    deviceIdName,
    deviceId,
    gpsId,
    companyId,
    companyName,
    alertType,
    severity,
    title,
    message,
    location = {},
    metadata = {},
    timestamp = new Date()
}) => {
    try {
        let devName = (deviceIdName || '').trim().toUpperCase();
        let targetCompanyId = companyId;
        let targetCompanyName = companyName;
        let targetDeviceId = deviceId;
        let targetGpsId = gpsId;

        // Resolve device and company if missing
        let matchedDevDoc = null;
        if ((!devName || devName === 'N/A' || !targetCompanyId || !targetGpsId) && (targetGpsId || devName || metadata?.mongoId)) {
            let query = null;
            if (targetGpsId != null && targetGpsId !== '') {
                const num = Number(targetGpsId);
                query = !isNaN(num) ? { $or: [{ gpsId: num }, { gpsId: String(targetGpsId) }] } : { gpsId: String(targetGpsId) };
            } else if (devName && devName !== 'N/A') {
                query = { name: devName };
            } else if (metadata?.mongoId != null) {
                query = { _id: metadata.mongoId };
            }

            if (query) {
                matchedDevDoc = await Device.findOne(query).lean();
                if (matchedDevDoc) {
                    if (!devName || devName === 'N/A') devName = (matchedDevDoc.name || '').trim().toUpperCase();
                    if (!targetCompanyId) targetCompanyId = matchedDevDoc.companyId;
                    if (!targetCompanyName && matchedDevDoc.companyName) targetCompanyName = matchedDevDoc.companyName;
                    if (!targetDeviceId) targetDeviceId = matchedDevDoc.deviceId;
                    if (!targetGpsId) targetGpsId = matchedDevDoc.gpsId;
                }
            }
        }

        if (targetCompanyId && !targetCompanyName) {
            const compDoc = await Company.findById(targetCompanyId, { name: 1 }).lean();
            if (compDoc) targetCompanyName = compDoc.name;
        }

        if (!devName || devName === 'N/A') {
            const diag = {
                alertType: alertType || null,
                gpsId: targetGpsId ?? null,
                imei: matchedDevDoc?.imei ?? metadata?.imei ?? null,
                mongoId: matchedDevDoc?._id ?? metadata?.mongoId ?? null,
                deviceId: targetDeviceId ?? null,
                company: targetCompanyName
                    ? `${targetCompanyName} (${targetCompanyId})`
                    : targetCompanyId ?? null,
                model: matchedDevDoc?.model ?? null,
                simCard: matchedDevDoc?.simCardNumber ?? null,
                status: matchedDevDoc?.status ?? null,
                isDeleted: matchedDevDoc?.isDeleted ?? null,
                inMongoDb: Boolean(matchedDevDoc),
                coords:
                    location?.latitude != null && location?.longitude != null
                        ? `${location.latitude},${location.longitude}`
                        : null,
                rawAlarm: metadata?.rawAlarm ?? metadata?.rawEvent?.attributes?.alarm ?? null
            };
            logger.warn(
                `[AlertService] Unable to record alert without device identifier (plate) | ${JSON.stringify(diag)}`
            );
            return null;
        }

        // Determine default severity if not provided
        let alertSeverity = severity;
        if (!alertSeverity) {
            if ([ALERT_TYPE.UNAUTHORIZED_DRIVING, ALERT_TYPE.POWER_CUT, ALERT_TYPE.UNAUTHORIZED_MOVEMENT, ALERT_TYPE.UNAUTHORIZED_IGNITION].includes(alertType)) {
                alertSeverity = ALERT_SEVERITY.CRITICAL;
            } else if ([ALERT_TYPE.GEOFENCE_EXIT, ALERT_TYPE.EXTENDED_OFFLINE].includes(alertType)) {
                alertSeverity = ALERT_SEVERITY.WARNING;
            } else {
                alertSeverity = ALERT_SEVERITY.INFO;
            }
        }

        // Fast-path: In-memory 30-minute summary buffer for UNAUTHORIZED_MOVEMENT
        // Zero MongoDB reads/writes during the interval; sends live SSE updates to frontend.
        if (alertType === ALERT_TYPE.UNAUTHORIZED_MOVEMENT) {
            const bufferKey = getMovementBufferKey(devName);
            const activeEntry = movementSummaryBuffers.get(bufferKey);
            const nowMs = Date.now();

            if (activeEntry && nowMs < activeEntry.windowExpiresAt) {
                const nowDate = new Date(nowMs);
                const incomingSpeed = location?.speed ?? metadata?.speed ?? 0;

                activeEntry.occurrenceCount += 1;
                activeEntry.lastSeenAt = nowDate;
                activeEntry.maxSpeed = Math.max(activeEntry.maxSpeed, incomingSpeed);
                activeEntry.dirty = true;

                if (location?.latitude && location?.longitude) {
                    activeEntry.alertSnapshot.location = {
                        ...activeEntry.alertSnapshot.location,
                        ...location
                    };
                }
                activeEntry.alertSnapshot.occurrenceCount = activeEntry.occurrenceCount;
                activeEntry.alertSnapshot.lastSeenAt = nowDate;
                activeEntry.alertSnapshot.metadata = {
                    ...(activeEntry.alertSnapshot.metadata || {}),
                    ...(metadata || {}),
                    maxSpeed: activeEntry.maxSpeed
                };

                if (nowMs - activeEntry.lastSseBroadcastAt >= MOVEMENT_SSE_THROTTLE_MS) {
                    activeEntry.lastSseBroadcastAt = nowMs;
                    sseService.broadcast(
                        'alert_updated',
                        { ...activeEntry.alertSnapshot, _isLiveSummaryUpdate: true },
                        { companyId: activeEntry.companyId }
                    );
                }

                return activeEntry.alertSnapshot;
            } else if (activeEntry) {
                // Window expired; flush final summary before opening a new interval
                await flushMovementBuffer(bufferKey);
            }
        }

        // Deduplication check: Has this exact alert occurred recently on this device while still ACTIVE or ACKNOWLEDGED?
        const cooldownMinutes = DEDUPLICATION_COOLDOWN_MINUTES[alertType] || 15;
        const cooldownThreshold = dayjs().subtract(cooldownMinutes, 'minute').toDate();

        const existingAlert = await AlertLog.findOne({
            deviceIdName: devName,
            alertType,
            status: { $in: [ALERT_STATUS.ACTIVE, ALERT_STATUS.ACKNOWLEDGED] },
            lastSeenAt: { $gte: cooldownThreshold }
        });

        if (existingAlert) {
            // Aggregate onto the active alert
            existingAlert.occurrenceCount = (existingAlert.occurrenceCount || 1) + 1;
            existingAlert.lastSeenAt = new Date();
            if (location.latitude && location.longitude) {
                existingAlert.location = { ...existingAlert.location, ...location };
            }
            if (metadata) {
                existingAlert.metadata = { ...existingAlert.metadata, ...metadata };
            }
            await existingAlert.save();

            if (alertType === ALERT_TYPE.UNAUTHORIZED_MOVEMENT) {
                registerMovementBuffer(existingAlert, targetCompanyId);
            }

            // Notify frontend of update
            sseService.broadcast('alert_updated', existingAlert.toObject(), { companyId: targetCompanyId });
            return existingAlert;
        }

        // Generate human friendly title if omitted
        let alertTitle = title;
        if (!alertTitle) {
            switch (alertType) {
                case ALERT_TYPE.UNAUTHORIZED_DRIVING:
                    alertTitle = `🚨 Sabotaje: Conducción en corte activo en ${devName}`;
                    break;
                case ALERT_TYPE.POWER_CUT:
                    alertTitle = `⚡ Corte de batería externa en ${devName}`;
                    break;
                case ALERT_TYPE.UNAUTHORIZED_MOVEMENT:
                    alertTitle = `🚨 Movimiento/remolque con motor bloqueado en ${devName}`;
                    break;
                case ALERT_TYPE.UNAUTHORIZED_IGNITION:
                    alertTitle = `🔑 Intento de ignición con motor en corte en ${devName}`;
                    break;
                case ALERT_TYPE.GEOFENCE_EXIT:
                    alertTitle = `📍 Salida de geocerca de ${devName}`;
                    break;
                case ALERT_TYPE.EXTENDED_OFFLINE:
                    alertTitle = `📡 Dispositivo offline prolongado (${devName})`;
                    break;
                default:
                    alertTitle = `Alerta en ${devName}`;
            }
        }

        const newAlert = new AlertLog({
            deviceIdName: devName,
            deviceId: targetDeviceId,
            gpsId: targetGpsId,
            companyId: targetCompanyId,
            companyName: targetCompanyName,
            alertType,
            severity: alertSeverity,
            status: ALERT_STATUS.ACTIVE,
            title: alertTitle,
            message: message || alertTitle,
            location: {
                latitude: location.latitude ?? null,
                longitude: location.longitude ?? null,
                address: location.address ?? null,
                speed: location.speed ?? 0
            },
            metadata: {
                cutOff: metadata.cutOff ?? null,
                ignition: metadata.ignition ?? null,
                motion: metadata.motion ?? null,
                batteryLevel: metadata.batteryLevel ?? null,
                hoursOffline: metadata.hoursOffline ?? null,
                rawAlarm: metadata.rawAlarm ?? null,
                rawEvent: metadata.rawEvent ?? null
            },
            occurrenceCount: 1,
            lastSeenAt: timestamp,
            timestamp
        });

        await newAlert.save();
        logger.info(`[AlertService] 🚨 Created alert [${alertType}] (${alertSeverity}) for device ${devName}`);

        if (alertType === ALERT_TYPE.UNAUTHORIZED_MOVEMENT) {
            registerMovementBuffer(newAlert, targetCompanyId);
        }

        // Broadcast to clients via SSE
        sseService.broadcast('new_alert', newAlert.toObject(), { companyId: targetCompanyId });

        return newAlert;
    } catch (err) {
        logger.error('[AlertService] Error recording alert:', err);
        return null;
    }
};

/**
 * Retrieve paginated alerts with filters
 */
export const getAlertsHistory = async ({
    companyId,
    isSuperAdmin = false,
    month,
    year,
    type,
    severity,
    status,
    search,
    page = 1,
    limit = 20,
    grouped = false
}) => {
    try {
        const query = {};

        // Multi-tenant isolation
        if (!isSuperAdmin) {
            if (companyId) {
                query.companyId = companyId;
            } else {
                return { alerts: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
            }
        } else if (companyId && companyId !== 'all') {
            query.companyId = companyId;
        }

        // Date filter: if month and year are specified
        if (month && year) {
            const startOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
            const endOfMonth = dayjs(startOfMonth).endOf('month').toDate();
            query.timestamp = { $gte: startOfMonth, $lte: endOfMonth };
        }

        // Filter by alert type
        if (type && type !== 'ALL') {
            query.alertType = type;
        }

        // Filter by severity
        if (severity && severity !== 'ALL') {
            query.severity = severity;
        }

        // Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)
        if (status && status !== 'ALL') {
            query.status = status;
        }

        // Search by plate/device name or title
        if (search && search.trim()) {
            const cleanSearch = search.trim();
            query.$or = [
                { deviceIdName: { $regex: cleanSearch, $options: 'i' } },
                { title: { $regex: cleanSearch, $options: 'i' } },
                { companyName: { $regex: cleanSearch, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const isGrouped = grouped === true || grouped === 'true' || grouped === '1';

        if (isGrouped) {
            const [aggResult] = await AlertLog.aggregate([
                { $match: query },
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: {
                            deviceIdName: '$deviceIdName',
                            alertType: '$alertType'
                        },
                        latestAlert: { $first: '$$ROOT' },
                        groupedCount: { $sum: 1 },
                        totalOccurrences: { $sum: { $ifNull: ['$occurrenceCount', 1] } },
                        history: {
                            $push: {
                                _id: '$_id',
                                timestamp: '$timestamp',
                                status: '$status',
                                severity: '$severity',
                                alertType: '$alertType',
                                deviceIdName: '$deviceIdName',
                                title: '$title',
                                message: '$message',
                                location: '$location',
                                metadata: '$metadata',
                                occurrenceCount: '$occurrenceCount',
                                resolvedAt: '$resolvedAt',
                                resolutionNotes: '$resolutionNotes'
                            }
                        }
                    }
                },
                { $sort: { 'latestAlert.timestamp': -1 } },
                {
                    $facet: {
                        items: [
                            { $skip: skip },
                            { $limit: limitNum },
                            {
                                $project: {
                                    _id: 0,
                                    latestAlert: 1,
                                    groupedCount: 1,
                                    totalOccurrences: 1,
                                    collapsedAlerts: { $slice: ['$history', 1, 15] }
                                }
                            }
                        ],
                        totalCount: [{ $count: 'total' }]
                    }
                }
            ]);

            const items = aggResult?.items || [];
            const total = aggResult?.totalCount?.[0]?.total || 0;
            const alerts = overlayActiveMovementBuffers(
                items.map((item) => ({
                    ...item.latestAlert,
                    groupedCount: item.groupedCount,
                    totalOccurrences: item.totalOccurrences,
                    collapsedAlerts: item.collapsedAlerts || []
                }))
            );

            return {
                success: true,
                alerts,
                grouped: true,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum) || 1
                }
            };
        }

        const [rawAlerts, total] = await Promise.all([
            AlertLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            AlertLog.countDocuments(query)
        ]);

        const alerts = overlayActiveMovementBuffers(rawAlerts);

        return {
            success: true,
            alerts,
            grouped: false,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1
            }
        };
    } catch (err) {
        logger.error('[AlertService] Error in getAlertsHistory:', err);
        throw err;
    }
};

/**
 * Calculate telemetry alert statistics for the selected period
 */
export const getAlertsStats = async ({
    companyId,
    isSuperAdmin = false,
    month,
    year
}) => {
    try {
        const query = {};

        if (!isSuperAdmin) {
            if (companyId) {
                query.companyId = companyId;
            } else {
                return {
                    total: 0,
                    active: 0,
                    resolved: 0,
                    critical: 0,
                    warning: 0,
                    counts: { unauthorizedDriving: 0, powerCut: 0, movement: 0, ignition: 0, geofence: 0, offline: 0 }
                };
            }
        } else if (companyId && companyId !== 'all') {
            query.companyId = companyId;
        }

        if (month && year) {
            const startOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
            const endOfMonth = dayjs(startOfMonth).endOf('month').toDate();
            query.timestamp = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const alerts = await AlertLog.find(query, {
            alertType: 1,
            severity: 1,
            status: 1
        }).lean();

        let total = alerts.length;
        let active = 0;
        let acknowledged = 0;
        let resolved = 0;
        let critical = 0;
        let warning = 0;
        let info = 0;

        const counts = {
            unauthorizedDriving: 0,
            powerCut: 0,
            movement: 0,
            ignition: 0,
            geofence: 0,
            offline: 0
        };

        for (const a of alerts) {
            if (a.status === ALERT_STATUS.ACTIVE) active++;
            else if (a.status === ALERT_STATUS.ACKNOWLEDGED) acknowledged++;
            else if (a.status === ALERT_STATUS.RESOLVED) resolved++;

            if (a.severity === ALERT_SEVERITY.CRITICAL) critical++;
            else if (a.severity === ALERT_SEVERITY.WARNING) warning++;
            else if (a.severity === ALERT_SEVERITY.INFO) info++;

            if (a.alertType === ALERT_TYPE.UNAUTHORIZED_DRIVING) counts.unauthorizedDriving++;
            else if (a.alertType === ALERT_TYPE.POWER_CUT) counts.powerCut++;
            else if (a.alertType === ALERT_TYPE.UNAUTHORIZED_MOVEMENT) counts.movement++;
            else if (a.alertType === ALERT_TYPE.UNAUTHORIZED_IGNITION) counts.ignition++;
            else if (a.alertType === ALERT_TYPE.GEOFENCE_EXIT) counts.geofence++;
            else if (a.alertType === ALERT_TYPE.EXTENDED_OFFLINE) counts.offline++;
        }

        return {
            success: true,
            stats: {
                total,
                active,
                acknowledged,
                resolved,
                critical,
                warning,
                info,
                counts
            }
        };
    } catch (err) {
        logger.error('[AlertService] Error in getAlertsStats:', err);
        throw err;
    }
};

/**
 * Update the status of an alert (e.g. ACKNOWLEDGED or RESOLVED)
 */
export const updateAlertStatus = async (alertId, { status, notes, user = {} }) => {
    try {
        const alert = await AlertLog.findById(alertId);
        if (!alert) {
            return { success: false, error: 'Alert not found' };
        }

        // Flush any active in-memory movement summary before changing status
        if (alert.alertType === ALERT_TYPE.UNAUTHORIZED_MOVEMENT) {
            const bufferKey = getMovementBufferKey(alert.deviceIdName);
            const activeEntry = movementSummaryBuffers.get(bufferKey);
            if (activeEntry && String(activeEntry.alertId) === String(alert._id)) {
                alert.occurrenceCount = activeEntry.occurrenceCount;
                alert.lastSeenAt = activeEntry.lastSeenAt;
                alert.location = activeEntry.alertSnapshot.location;
                alert.metadata = activeEntry.alertSnapshot.metadata;
                movementSummaryBuffers.delete(bufferKey);
                if (activeEntry.timer) clearTimeout(activeEntry.timer);
            }
        }

        alert.status = status;

        if (status === ALERT_STATUS.ACKNOWLEDGED) {
            alert.acknowledgedAt = new Date();
            alert.acknowledgedBy = {
                userId: user.userId || user.id,
                name: user.name || user.username || 'Admin',
                username: user.username
            };
        } else if (status === ALERT_STATUS.RESOLVED) {
            alert.resolvedAt = new Date();
            alert.resolvedBy = {
                userId: user.userId || user.id,
                name: user.name || user.username || 'Admin',
                username: user.username
            };
            if (notes) {
                alert.resolutionNotes = notes;
            }
        }

        await alert.save();

        sseService.broadcast('alert_updated', alert.toObject(), { companyId: alert.companyId });

        return { success: true, alert };
    } catch (err) {
        logger.error('[AlertService] Error in updateAlertStatus:', err);
        throw err;
    }
};

/**
 * Evaluates live telemetry for security alert conditions
 */
export const processTelemetryAlert = async (deviceState, update, rawPos = {}) => {
    try {
        if (!deviceState) return;

        const devName = deviceState.name;
        const gpsId = deviceState.gpsId;
        const companyId = deviceState.companyId;
        const cutOff = deviceState.cutOff;
        const ignition = update.ignition !== undefined ? update.ignition : deviceState.ignition;
        const motion = update.motion !== undefined ? update.motion : deviceState.motion;
        const powerCut = update.powerCut !== undefined ? update.powerCut : deviceState.powerCut;
        const speed = rawPos.speed ?? update.speed ?? 0;
        const location = {
            latitude: rawPos.latitude ?? null,
            longitude: rawPos.longitude ?? null,
            address: rawPos.address ?? null,
            speed
        };
        const metadata = {
            mongoId: deviceState._id ?? null,
            imei: deviceState.imei ?? null,
            cutOff,
            ignition,
            motion,
            batteryLevel: update.batteryLevel ?? deviceState.batteryLevel,
            rawAlarm: rawPos.attributes?.alarm || null
        };

        // 1. ⚡ Power Cut (Battery disconnected)
        if (powerCut === true) {
            await recordAlert({
                deviceIdName: devName,
                gpsId,
                companyId,
                alertType: ALERT_TYPE.POWER_CUT,
                severity: ALERT_SEVERITY.CRITICAL,
                title: `⚡ Corte de alimentación externa en ${devName}`,
                message: `El rastreador GPS reportó corte de batería externa o desconexión del arnés.`,
                location,
                metadata
            });
        }

        // 2. 🚨 Theft / Sabotage / Bypass detection when motor is in cutOff state
        const rawAlarm = (rawPos.attributes?.alarm || '').toString().toLowerCase();
        const hasTowingAlarm = rawAlarm.includes('tow') || rawAlarm.includes('vibration') || rawAlarm.includes('movement');
        const hasPhysicalMovement = motion === true || speed > 10;

        if (cutOff === true && ignition === true && speed >= 15) {
            // CERTEZA ABSOLUTA DE SABOTAJE / RELÉ PUENTEADO:
            // El vehículo tiene orden de apagado (cutOff=true), switch encendido (ignition=true) y avanza a velocidad de tránsito (speed >= 15 km/h).
            await recordAlert({
                deviceIdName: devName,
                gpsId,
                companyId,
                alertType: ALERT_TYPE.UNAUTHORIZED_DRIVING,
                severity: ALERT_SEVERITY.CRITICAL,
                title: `🚨 Sabotaje: Conducción en corte activo en ${devName}`,
                message: `El vehículo está en marcha activa (${Math.round(speed)} km/h) con el switch encendido a pesar de tener orden de corte de motor. Posible relé puenteado o inoperativo.`,
                location,
                metadata: { ...metadata, speed, bypassSuspected: true }
            });
        } else if (cutOff === true && ignition === true) {
            // Intento de encendido con corte activo (estacionario o velocidad baja < 15 km/h)
            await recordAlert({
                deviceIdName: devName,
                gpsId,
                companyId,
                alertType: ALERT_TYPE.UNAUTHORIZED_IGNITION,
                severity: ALERT_SEVERITY.CRITICAL,
                title: `🔑 Ignición forzada con motor en corte en ${devName}`,
                message: `El switch de encendido fue activado mientras el vehículo tiene orden de bloqueo activa.`,
                location,
                metadata
            });
        } else if (cutOff === true && (hasTowingAlarm || hasPhysicalMovement)) {
            // Desplazamiento o remolque con switch apagado
            await recordAlert({
                deviceIdName: devName,
                gpsId,
                companyId,
                alertType: ALERT_TYPE.UNAUTHORIZED_MOVEMENT,
                severity: ALERT_SEVERITY.CRITICAL,
                title: `🚨 Movimiento no autorizado / Remolque en ${devName}`,
                message: `Se detectó desplazamiento (${Math.round(speed)} km/h) o vibración con el motor en corte.`,
                location,
                metadata: { ...metadata, speed, rawAlarm }
            });
        }

        // 4. 📍 Geofence Exit from position alarm
        if (rawAlarm.includes('geofenceexit') || rawAlarm.includes('geofence_exit')) {
            await recordAlert({
                deviceIdName: devName,
                gpsId,
                companyId,
                alertType: ALERT_TYPE.GEOFENCE_EXIT,
                severity: ALERT_SEVERITY.WARNING,
                title: `📍 Salida de Geocerca en ${devName}`,
                message: `El vehículo ha salido de su perímetro de operación autorizado.`,
                location,
                metadata
            });
        }
    } catch (err) {
        logger.error('[AlertService] Error processing telemetry alert:', err);
    }
};

/**
 * Process events from Traccar WebSocket data.events array
 */
export const processTraccarEvents = async (events = []) => {
    if (!Array.isArray(events) || events.length === 0) return;

    for (const evt of events) {
        try {
            const gpsId = evt.deviceId;
            const eventType = (evt.type || '').toLowerCase();
            const alarm = (evt.attributes?.alarm || '').toLowerCase();

            let alertType = null;
            let severity = ALERT_SEVERITY.WARNING;
            let message = '';

            if (alarm.includes('powercut') || alarm.includes('poweroff') || eventType === 'alarm_powercut') {
                alertType = ALERT_TYPE.POWER_CUT;
                severity = ALERT_SEVERITY.CRITICAL;
                message = 'Alerta de desconexión de energía reportada por Traccar.';
            } else if (alarm.includes('lowbattery') || alarm.includes('low_battery')) {
                alertType = ALERT_TYPE.POWER_CUT;
                severity = ALERT_SEVERITY.WARNING;
                message = 'Alerta de batería baja del rastreador GPS reportada por Traccar.';
            } else if (alarm.includes('tow') || alarm.includes('vibration') || alarm.includes('movement')) {
                alertType = ALERT_TYPE.UNAUTHORIZED_MOVEMENT;
                severity = ALERT_SEVERITY.CRITICAL;
                message = `Evento de movimiento / alarma (${alarm}) reportado por Traccar.`;
            } else if (eventType === 'geofenceexit') {
                alertType = ALERT_TYPE.GEOFENCE_EXIT;
                severity = ALERT_SEVERITY.WARNING;
                message = 'Salida de geocerca reportada por el servidor GPS.';
            }

            if (alertType && gpsId) {
                // Only record UNAUTHORIZED_MOVEMENT from Traccar events when the device is actually in cutOff
                if (alertType === ALERT_TYPE.UNAUTHORIZED_MOVEMENT) {
                    const num = Number(gpsId);
                    const devQuery = !isNaN(num)
                        ? { $or: [{ gpsId: num }, { gpsId: String(gpsId) }] }
                        : { gpsId: String(gpsId) };
                    const devDoc = await Device.findOne(devQuery, { name: 1, cutOff: 1, companyId: 1, deviceId: 1 }).lean();
                    if (!devDoc || devDoc.cutOff !== true) {
                        continue;
                    }
                    await recordAlert({
                        deviceIdName: devDoc.name,
                        deviceId: devDoc.deviceId,
                        gpsId,
                        companyId: devDoc.companyId,
                        alertType,
                        severity,
                        message,
                        metadata: { cutOff: true, rawEvent: evt }
                    });
                    continue;
                }

                await recordAlert({
                    gpsId,
                    alertType,
                    severity,
                    message,
                    metadata: { rawEvent: evt }
                });
            }
        } catch (e) {
            logger.error('[AlertService] Error parsing Traccar event:', e);
        }
    }
};

export default {
    recordAlert,
    getAlertsHistory,
    getAlertsStats,
    updateAlertStatus,
    processTelemetryAlert,
    processTraccarEvents
};
