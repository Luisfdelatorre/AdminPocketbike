import { Device } from '../models/Device.js';
import logger from '../config/logger.js';

class DeviceRepository {
    /**
     * Upsert devices in batch from Traccar
     */
    async upsertDevicesBatch(devices) {
        try {
            if (!devices || devices.length === 0) {
                logger.info('No devices to upsert');
                return;
            }

            const bulkOps = devices.map(device => ({
                updateOne: {
                    filter: { _id: device.id },
                    update: {
                        $set: {
                            _id: device.id,
                            uniqueId: device.uniqueId,
                            name: device.name,
                            model: device.model,
                            status: device.status,
                            disabled: device.disabled,
                            lastUpdate: device.lastUpdate,
                            positionId: device.positionId,
                            phone: device.phone,
                            contact: device.contact,
                            groupId: device.groupId,
                            calendarId: device.calendarId,
                            category: device.category,
                            attributes: device.attributes || {}
                        }
                    },
                    upsert: true
                }
            }));

            const result = await Device.bulkWrite(bulkOps);
            logger.info(`Upserted ${result.upsertedCount} devices, modified ${result.modifiedCount} devices`);
            return result;
        } catch (error) {
            logger.error('Error upserting devices batch:', error);
            throw error;
        }
    }

    /**
     * Get all devices
     */
    async getAllDevices() {
        try {
            return await Device.find({});
        } catch (error) {
            logger.error('Error getting all devices:', error);
            throw error;
        }
    }

    /**
     * Find devices by company
     * @param {String} companyId 
     */
    async findDevicesByCompany(companyId) {
        try {
            return await Device.find({ companyId });
        } catch (error) {
            logger.error(`Error finding devices for company ${companyId}:`, error);
            throw error;
        }
    }

    /**
     * Get device by ID
     * @param {String} id 
     */
    async getDeviceById(id) {
        try {
            return await Device.findById(id);
        } catch (error) {
            logger.error(`Error getting device by id ${id}:`, error);
            throw error;
        }
    }

    /**
     * Get device payment info by name
     */
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

    /**
     * Get device by name
     */
    async getDeviceByName(name) {
        try {
            return await Device.findOne({ name });
        } catch (error) {
            logger.error(`Error getting device by name ${name}:`, error);
            throw error;
        }
    }

    /**
     * Update device contract status
     * @param {String} deviceId 
     * @param {String|null} contractId 
     * @param {Boolean} hasContract 
     */
    async updateContractStatus(deviceId, contractId, hasContract) {
        try {
            return await Device.findByIdAndUpdate(deviceId, {
                activeContractId: contractId,
                hasActiveContract: hasContract
            }, { new: true });
        } catch (error) {
            logger.error(`Error updating contract status for device ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Assign contract details to device (Sync on creation)
     * @param {String} deviceId
     * @param {Object} data { contractId, driverName, nequiNumber }
     */
    async assignContractToDevice(deviceId, { contractId, driverName, nequiNumber }) {
        try {
            const updateData = {
                activeContractId: contractId,
                hasActiveContract: true,
                contractId: contractId, // Sync requested by user
                driverName: driverName,
                nequiNumber: nequiNumber
            };

            // Remove undefined/null values to avoid overwriting with null if not provided
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined || updateData[key] === null) {
                    delete updateData[key];
                }
            });
            return await Device.findByIdAndUpdate(deviceId, updateData, { new: true });
        } catch (error) {
            logger.error(`Error assigning contract to device ${deviceId}:`, error);
            throw error;
        }
    }
}

export default new DeviceRepository();
