import deviceRepository from '../repositories/deviceRepository.js';
import { Device } from '../models/Device.js';
import { Transaction, PAYMENTMESSAGES as PM } from '../config/config.js';
import MegaRastreo from '../services/megaRastreoServices1.js';


// Centralized Day.js
import dayjs from '../config/dayjs.js';

const {
    JWT_SECRET, JWT_EXPIRY,
    PAYMENT_STATUS: PS,
    PAYMENT_TYPE,
    INVOICE_DAYTYPE,
    MAX_NEQUI_PAYMENT_TIMEOUT,
    TEMPORARY_RESERVATION_TIMEOUT,
    MAX_RETRY_ATTEMPTS,
    RETRY_CHECK_INTERVAL,
    INVOICE_DAYTYPE_TRANSLATION
} = Transaction;


const getDeviceList = async (deviceIdName) => {
    const gpsDevices = await MegaRastreo.fetchDevices();
    console.log(`📡 Fetched ${gpsDevices.length} devices from GPS.`);
    // Prepare bulk operations for Devices

    return gpsDevices;
};

const bulkWriteDevices = async (gpsDevices) => {
    const deviceOps = gpsDevices.map(d => {
        const mapped = {
            _id: d.deviceId, // Map "id" to internal "gpsId"
            name: d.name,
            model: d.model,
            category: d.icon,
            lastUpdate: d.interaction?.lastUpdatedTime,
            companyId: d.propertyId,
            deviceId: d.deviceId,
            uniqueId: d.device.name,
            nequiNumber: d.phone,
            simCardNumber: d.simCard?.name,
            companyName: d.property?.name,
        };
        console.log(mapped);
        return {
            updateOne: {
                filter: { _id: d.deviceId },
                update: { $set: mapped },
                upsert: true
            }
        };
    });
    console.log(deviceOps);


    const deviceResult = Device.bulkWrite(deviceOps);

    const stats = {
        created: deviceResult.upsertedCount,
        updated: deviceResult.modifiedCount,
        errors: 0
    };
    return stats;
}

export default {
    getDeviceList,
    bulkWriteDevices
};

