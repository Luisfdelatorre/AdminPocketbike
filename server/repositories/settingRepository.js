import Setting from '../models/Setting.js';
import logger from '../utils/logger.js';
import { 
    SETTING_KEYS, 
    SETTINGS_DEFINITIONS, 
    DEFAULT_PAYMENT_STATUSES, 
    DEFAULT_ADJUSTMENT_TYPES 
} from '../config/config.js';

class SettingRepository {
    constructor() {
        this.cachedAdjustmentTypes = null;
        this.cachedPaymentStatuses = null;
    }

    async getSetting(key, defaultValue = null) {
        try {
            const setting = await Setting.findOne({ key }).lean();
            if (setting) return setting.value;

            const definition = SETTINGS_DEFINITIONS[key];
            if (definition) {
                await this.setSetting(key, definition.defaultValue, definition.description);
                return definition.defaultValue;
            }

            return defaultValue;
        } catch (error) {
            logger.error(`Error getting setting key '${key}':`, error);
            const definition = SETTINGS_DEFINITIONS[key];
            return definition ? definition.defaultValue : defaultValue;
        }
    }

    async setSetting(key, value, description = '') {
        try {
            const setting = await Setting.findOneAndUpdate(
                { key },
                { key, value, description },
                { upsert: true, new: true, lean: true }
            );
            return setting.value;
        } catch (error) {
            logger.error(`Error setting key '${key}':`, error);
            throw error;
        }
    }

    async getPaymentStatuses() {
        if (this.cachedPaymentStatuses) {
            return this.cachedPaymentStatuses;
        }

        const stored = await this.getSetting(SETTING_KEYS.PAYMENT_STATUS, DEFAULT_PAYMENT_STATUSES);
        const statuses = (stored && Object.keys(stored).length > 0) ? stored : DEFAULT_PAYMENT_STATUSES;
        Object.keys(statuses).forEach(key => {
            if (!statuses[key].category) {
                statuses[key].category = 'STATUS';
            }
        });
        this.cachedPaymentStatuses = statuses;
        return statuses;
    }

    async updatePaymentStatuses(statusesData) {
        const description = SETTINGS_DEFINITIONS[SETTING_KEYS.PAYMENT_STATUS]?.description || '';
        await this.setSetting(SETTING_KEYS.PAYMENT_STATUS, statusesData, description);
        this.cachedPaymentStatuses = null;
        return this.getPaymentStatuses();
    }

    async getAdjustmentTypes() {
        if (this.cachedAdjustmentTypes) {
            return this.cachedAdjustmentTypes;
        }

        const stored = await this.getSetting(SETTING_KEYS.ADJUSTMENT_TYPES, DEFAULT_ADJUSTMENT_TYPES);
        const types = (stored && Object.keys(stored).length > 0) ? stored : DEFAULT_ADJUSTMENT_TYPES;
        Object.keys(types).forEach(key => {
            if (!types[key].category) {
                types[key].category = 'ADJUSTMENT';
            }
        });
        this.cachedAdjustmentTypes = types;
        return types;
    }

    async updateAdjustmentTypes(typesData) {
        const description = SETTINGS_DEFINITIONS[SETTING_KEYS.ADJUSTMENT_TYPES]?.description || '';
        await this.setSetting(SETTING_KEYS.ADJUSTMENT_TYPES, typesData, description);
        this.cachedAdjustmentTypes = null;
        return this.getAdjustmentTypes();
    }

    async getAllStatusConfigs() {
        const [statuses, adjustments] = await Promise.all([
            this.getPaymentStatuses(),
            this.getAdjustmentTypes()
        ]);
        return { ...statuses, ...adjustments };
    }

    invalidateCache() {
        this.cachedAdjustmentTypes = null;
        this.cachedPaymentStatuses = null;
    }
}

export default new SettingRepository();
