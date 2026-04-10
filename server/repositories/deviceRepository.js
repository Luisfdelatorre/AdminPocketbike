import { Device } from '../models/Device.js';
import logger from '../config/logger.js';

class DeviceRepository {
    async insertDevicesBatch(docs) {
        try {
            if (!docs || docs.length === 0) return { created: 0, updated: 0, errors: 0 };

            const bulkOps = docs.map(doc => ({
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
    async upsertDevicesBatch(bulkOps) {
        try {
            // console.log('bulkOps', bulkOps);
            const result = await Device.bulkWrite(bulkOps);
            logger.info(`GPS sync upsert: ${result.upsertedCount} created, ${result.modifiedCount} updated`);
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
            return await Device.findOne({ name });
        } catch (error) {
            logger.error(`Error getting device by name ${name}:`, error);
            throw error;
        }
    }
    async updateContractStatus(deviceId, contractId, hasContract) {
        // try {
        // Cast deviceId to Number because the DB uses Numeric _id (Mixed type in schema)
        const numericId = !isNaN(deviceId) ? Number(deviceId) : deviceId;

        console.log('Update contract status for device:', numericId, contractId, hasContract);
        const result = await Device.findByIdAndUpdate(numericId, {
            activeContractId: contractId,
            hasActiveContract: hasContract
        }, { new: true });

        console.log('Update contract status result:', result);
        return result;
        // } catch (error) {
        //  logger.error(`Error updating contract status for device ${deviceId}:`, error);
        //  throw error;
        // }
    }
    async assignContractToDevice(contract, data, device) {
        try {
            const updateData = {
                activeContractId: contract.contractId,
                hasActiveContract: true,
                contractId: contract.contractId, // Sync requested by user
                driverName: contract.driverName,
                nequiNumber: contract.nequiNumber,
                companyId: contract.companyId,
                companyName: contract.companyName,
                dailyRate: contract.dailyRate,
                exemptFromCutOff: contract.exemptFromCutOff
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
            return await Device.findOneAndUpdate(
                { deviceId: deviceId },
                { cutOff: cutOff },
                { new: true }
            );
        } catch (error) {
            logger.error(`Error updating cutOff status for device ${deviceId}:`, error);
            throw error;
        }
    }
    async updateDeviceCutOff(objectId, cutOff) {
        try {
            return await Device.updateOne(
                { _id: objectId },
                { $set: { cutOff } }
            );
        } catch (error) {
            logger.error(`Error updating device _id ${objectId} cutOff:`, error);
            throw error;
        }
    }
    async updateDeviceExemption(deviceIdentifier, exemptFromCutOff) {
        try {
            const query = !isNaN(deviceIdentifier) ? { _id: Number(deviceIdentifier) } : { name: deviceIdentifier };
            return await Device.findOneAndUpdate(
                query,
                { exemptFromCutOff: exemptFromCutOff },
                { new: true }
            );
        } catch (error) {
            logger.error(`Error updating exemption for device ${deviceIdentifier}:`, error);
            throw error;
        }
    }
}

export default new DeviceRepository();
