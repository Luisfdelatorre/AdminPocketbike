import { Device } from '../models/Device.js';
import { DeviceState } from '../entities/deviceEntities.js';
import logger from '../config/logger.js';

const GPS_CACHE_PROJECTION = '_id name gpsId imei companyId telemetry';

class DeviceRepository {
    async findForGpsCache() {
        const devices = await Device.find({}, GPS_CACHE_PROJECTION).lean();
        return devices.map(d => new DeviceState(d));
    }
    async insertDevicesBatch(docs) {
        try {
            if (!docs || docs.length === 0) return { created: 0, updated: 0, errors: 0 };

            // Delegate ID generation + cleanup to the model static
            // (bulkWrite bypasses Mongoose middleware/defaults, so we do it explicitly here)
            const preparedDocs = Device.prepareForBulkWrite(docs);

            const bulkOps = preparedDocs.map(doc => ({
                updateOne: {
                    filter: { _id: doc._id },
                    update: [{ $set: doc }],   // pipeline stage — allows computed fields
                    upsert: true
                }
            }));

            const result = await Device.bulkWrite(bulkOps);
            logger.info(`GPS sync: ${result.upsertedCount} created, ${result.modifiedCount} updated`);
            return {
                created: result.upsertedCount,
                updated: result.modifiedCount,
                errors: 0
            };
        } catch (error) {
            logger.error('Error upserting devices batch:', error);
            throw error;
        }
    }
    async upsertDevicesBatch(devices) {
        try {
            if (!devices || devices.length === 0) return { created: 0, updated: 0, errors: 0 };

            const bulkOps = devices.map(mem => {
                const telemetry = {
                    ignition: mem.ignition,
                    lastUpdate: mem.lastUpdate,
                    cutOff: mem.cutOff,
                    batteryLevel: mem.batteryLevel,
                    queued: Boolean(mem.queued),
                    powerCut: Boolean(mem.powerCut),
                    alarm: mem.alarm || null,
                    motion: Boolean(mem.motion)
                };

                return {
                    updateOne: {
                        filter: { _id: mem._id },
                        update: {
                            $set: { telemetry }
                        }
                    }
                };
            });

            const result = await Device.bulkWrite(bulkOps);
            return {
                created: result.upsertedCount,
                updated: result.modifiedCount,
                errors: 0
            };
        } catch (error) {
            logger.error('Error upserting devices batch:', error);
            throw error;
        }
    }
    async getDevices(query = {}, projection = null) {
        try {
            const select = projection || 'id name status disabled gpsId companyId companyName contractId deviceId hasActiveContract isActive freeDays freeDaysUsed activeContractId monthPaid monthDebt nequiNumber simCardNumber telemetry';
            return await Device.find(query)
                .select(select)
                .lean()
                .sort({ _id: 1 });
        } catch (error) {
            logger.error('Error getting devices:', error);
            throw error;
        }
    }
    async getAllDevices() {
        try {
            return await Device.find({});
        } catch (error) {
            logger.error('Error getting all devices:', error);
            throw error;
        }
    }
    async getDevicesForGpsSync() {
        try {
            return await Device.find({}, 'imei companyId').lean();
        } catch (error) {
            logger.error('Error getting devices for GPS sync:', error);
            throw error;
        }
    }
    async getDevicesByCompanyId(companyId) {
        try {
            return await Device.find({ companyId }).lean();
        } catch (error) {
            logger.error(`Error getting devices for company ${companyId}:`, error);
            throw error;
        }
    }
    async getActiveDevices() {
        try {
            return await Device.find({ hasActiveContract: true }).lean();
        } catch (error) {
            logger.error('Error getting active devices:', error);
            throw error;
        }
    }
    async getDevicesWithActiveContracts(companyIds = null) {
        try {
            const query = { hasActiveContract: true };
            if (companyIds && Array.isArray(companyIds) && companyIds.length > 0) {
                query.companyId = { $in: companyIds };
            }
            return await Device.find(query).lean();
        } catch (error) {
            logger.error('Error getting devices with active contracts:', error);
            throw error;
        }
    }
    async findDevicesByCompany(companyId) {
        try {
            return await Device.find({ companyId });
        } catch (error) {
            logger.error(`Error finding devices for company ${companyId}:`, error);
            throw error;
        }
    }
    async getDeviceById(id) {
        try {
            return await Device.findById(id);
        } catch (error) {
            logger.error(`Error getting device by id ${id}:`, error);
            throw error;
        }
    }
    async getDevicePaymentInfo(name) {
        try {
            const device = await Device.findOne({ name });

            if (!device) {
                logger.warn(`Device not found: ${name}`);
                return null;
            }

            return device.toPaymentInfo();
        } catch (error) {
            logger.error(`Error getting device payment info for ${name}:`, error);
            throw error;
        }
    }
    async getDeviceByName(name) {
        try {
            if (!name) return null;
            const numericId = !isNaN(name) ? Number(name) : name;
            return await Device.findOne({
                $or: [
                    { name: name },
                    { plate: name },
                    { _id: numericId }
                ]
            });
        } catch (error) {
            logger.error(`Error getting device by name ${name}:`, error);
            throw error;
        }
    }
    async getDeviceStatusByName(deviceIdName) {
        try {
            const device = await Device.findOne(
                { name: deviceIdName },
                'name gpsId imei telemetry companyId hasActiveContract'
            ).lean();

            if (!device) {
                logger.warn(`[DEVICE STATUS] Device not found for name: ${deviceIdName}`);
                return { deviceIdName, engineOn: null, cutOff: null };
            }

            const tel = device.telemetry || {};
            const ignition = tel.ignition ?? false;
            const cutOff = tel.cutOff ?? false;
            const batteryLevel = tel.batteryLevel ?? null;
            const lastUpdate = tel.lastUpdate || null;

            return {
                name: device.name,
                gpsId: device.gpsId,
                telemetry: {
                    ignition,
                    lastUpdate,
                    cutOff,
                    batteryLevel,
                    powerCut: Boolean(tel.powerCut),
                    alarm: tel.alarm || null,
                    motion: Boolean(tel.motion),
                    queued: Boolean(tel.queued)
                },
                ignition,
                lastUpdate,
                cutOff,
                batteryLevel,
                hasActiveContract: device.hasActiveContract,
            };
        } catch (error) {
            logger.error(`Error getting device status for ${deviceIdName}:`, error);
            throw error;
        }
    }
    async updateContractStatus(deviceIdName, contractId, hasActiveContract, extra = {}) {
        try {
            const isNum = !isNaN(deviceIdName);
            const filter = isNum
                ? { _id: Number(deviceIdName) }
                : { $or: [{ name: String(deviceIdName) }, { _id: deviceIdName }] };

            const updateFields = {
                contractId: contractId || null,
                activeContractId: contractId || null,
                hasActiveContract: Boolean(hasActiveContract),
                ...extra
            };

            // If active contract is removed and customerName wasn't explicitly specified, clear customerName
            if (!hasActiveContract && extra.customerName === undefined && extra.driverName === undefined) {
                updateFields.customerName = null;
                updateFields.driverName = null;
            } else if (extra.customerName !== undefined && extra.driverName === undefined) {
                updateFields.driverName = extra.customerName;
            }

            return await Device.findOneAndUpdate(
                filter,
                updateFields,
                { new: true }
            );
        } catch (error) {
            logger.error(`Error updating contract status for device ${deviceIdName}:`, error);
            throw error;
        }
    }
    async assignContractToDevice(contract, data, device) {
        try {
            const updateData = {
                activeContractId: contract.contractId,
                hasActiveContract: true,
                contractId: contract.contractId, // Sync requested by user
                customerName: contract.customerName || null,
                driverName: contract.customerName || null,
                nequiNumber: contract.nequiNumber,
                companyId: contract.companyId,
                companyName: contract.companyName,
                dailyRate: contract.dailyRate,
                exemptFromCutOff: contract.exemptFromCutOff,
                exemptFromCurfew: contract.exemptFromCurfew,
                cutOffTime: contract.cutOffTime
            };

            // Remove undefined/null values to avoid overwriting with null if not provided
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined || updateData[key] === null) {
                    delete updateData[key];
                }
            });
            return await Device.findByIdAndUpdate(device.deviceId, updateData, { new: true });
        } catch (error) {
            logger.error(`Error assigning contract to device ${device.deviceId}:`, error);
            throw error;
        }
    }
    async updateCutOffStatus(deviceId, cutOff) {
        try {
            const isNum = !isNaN(deviceId);
            const filter = isNum
                ? { $or: [{ deviceId: Number(deviceId) }, { _id: Number(deviceId) }] }
                : { $or: [{ name: String(deviceId) }, { _id: deviceId }] };

            return await Device.findOneAndUpdate(
                filter,
                {
                    $set: {
                        'telemetry.cutOff': Boolean(cutOff)
                    }
                },
                { new: true }
            );
        } catch (error) {
            logger.error(`Error updating cutOff status for device ${deviceId}:`, error);
            throw error;
        }
    }
    async updateCutOffByGpsId(gpsId, cutOff) {
        try {
            return await Device.findOneAndUpdate(
                { gpsId: gpsId },
                {
                    $set: {
                        'telemetry.cutOff': Boolean(cutOff)
                    }
                },
                { new: true }
            );
        } catch (error) {
            logger.error(`Error updating cutOff status by gpsId ${gpsId}:`, error);
            throw error;
        }
    }
    async updateDeviceCutOff(objectId, cutOff) {
        try {
            return await Device.updateOne(
                { _id: objectId },
                {
                    $set: {
                        'telemetry.cutOff': Boolean(cutOff)
                    }
                }
            );
        } catch (error) {
            logger.error(`Error updating device _id ${objectId} cutOff:`, error);
            throw error;
        }
    }
    async updateDeviceQueuedStatus(objectId, queued) {
        try {
            return await Device.updateOne(
                { _id: objectId },
                {
                    $set: {
                        'telemetry.queued': Boolean(queued)
                    }
                }
            );
        } catch (error) {
            logger.error(`Error updating device _id ${objectId} queued status:`, error);
            throw error;
        }
    }
    async updateDeviceExemption(deviceIdentifier, exemptFromCutOff, exemptFromCurfew) {
        try {
            const query = !isNaN(deviceIdentifier) ? { _id: Number(deviceIdentifier) } : { name: deviceIdentifier };
            const update = {};
            if (exemptFromCutOff !== undefined) update.exemptFromCutOff = exemptFromCutOff;
            if (exemptFromCurfew !== undefined) update.exemptFromCurfew = exemptFromCurfew;
            return await Device.findOneAndUpdate(
                query,
                update,
                { new: true }
            );
        } catch (error) {
            logger.error(`Error updating exemption for device ${deviceIdentifier}:`, error);
            throw error;
        }
    }

    async bulkUpdateDeviceOdometers(items = []) {
        if (!items || items.length === 0) return { modifiedCount: 0 };
        try {
            const now = new Date();
            const bulkOps = items.map(item => ({
                updateOne: {
                    filter: { _id: item.deviceId },
                    update: {
                        $set: {
                            'telemetry.totalKm': item.totalKm,
                            'telemetry.lastKmSyncAt': now
                        }
                    }
                }
            }));
            const result = await Device.bulkWrite(bulkOps, { ordered: false });
            return result;
        } catch (error) {
            logger.error('Error bulk updating device odometers:', error);
            throw error;
        }
    }
}

export default new DeviceRepository();
