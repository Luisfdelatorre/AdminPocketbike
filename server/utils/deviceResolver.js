import { Device } from '../models/Device.js';

/**
 * Resolves a device identifier (ID or Name) to the internal Device ID (_id).
 * @param {string|number} identifier - The device ID or Device Name
 * @returns {Promise<number|string>} - The resolved Device ID (_id) or original identifier
 */
export const resolveDeviceId = async (identifier) => {
    if (!identifier) return identifier;

    // 1. Try lookup by deviceName (Prioritize Name String)
    const deviceByName = await Device.findOne({ deviceName: identifier });
    if (deviceByName) {
        return deviceByName._id;
    }

    // 2. If valid number, return as is (assuming it's an ID)
    // We don't need to DB check here necessarily, unless we want strict validation.
    // But since contracts/invoices are linked by ID, passing the ID "1" is valid.
    if (!isNaN(identifier) && !isNaN(parseFloat(identifier))) {
        return identifier;
    }

    // 3. Fallback: Return original (it might be an invalid name, caller will likely fail to find data)
    return identifier;
};
