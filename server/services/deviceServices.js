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
        return {
            updateOne: {
                filter: { _id: d.deviceId },
                update: [
                    { $set: d },
                    {
                        $set: {
                            companyId: {
                                $ifNull: ["$companyId", d.propertyId]
                            },
                            companyName: {
                                $ifNull: ["$companyName", d.property?.name]
                            }
                        }
                    }
                ],
                upsert: true
            }
        };
    });

    console.log(JSON.stringify(deviceOps));
    const deviceResult = await Device.bulkWrite(deviceOps);
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

