import deviceRepository from '../repositories/deviceRepository.js';
import { Device } from '../models/Device.js';
import { Transaction, PAYMENTMESSAGES as PM } from '../config/config.js';
import MegaRastreo from '../services/megaRastreoServices1.js';
import helper from '../utils/helpers.js';




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




const bulkWriteDevices = async (gpsDevices) => {
    const deviceOps = gpsDevices.map(d => {
        d.deviceId = helper.generateDeviceId(d.name);
        return {
            updateOne: {
                filter: { _id: d.deviceId }, // Match by megaDeviceId (unique from API)
                update: [
                    { $set: d }, // Update all fields from API`
                ],
                upsert: true
            }
        };
    });

    // console.log(JSON.stringify(deviceOps));
    const deviceResult = await Device.bulkWrite(deviceOps);
    const stats = {
        created: deviceResult.upsertedCount,
        updated: deviceResult.modifiedCount,
        errors: 0
    };
    return stats;
}

const initializeGpsUpdates = async () => {
    const devices = await Device.find({}, 'imei').lean();
    const imeis = devices.map(d => d.imei).filter(Boolean);
    console.log(`📡 Initializing GPS updates for ${imeis.length} devices...`);

    const onFlush = async (batch) => {
        if (!batch || batch.length === 0) return;

        await Promise.allSettled(
            batch.map(({ filter, update }) =>
                Device.updateOne(filter, { $set: update })
            )
        );
    };

    await MegaRastreo.startAutoUpdate(imeis, onFlush);
};

export default {
    bulkWriteDevices,
    initializeGpsUpdates
};

