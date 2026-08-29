import Setting from '../models/Setting.js';
import logger from '../utils/logger.js';

const DEFAULT_ADJUSTMENT_TYPES = {
    PAID: {
        label: 'Día Pagado',
        badgeLabel: 'Pagado',
        color: '#0ea5e9',
        bg: 'rgba(14,165,233,0.08)',
        description: 'Factura pagada.',
        isRealPayment: true,
        isFree: false
    },
    FREE: {
        label: 'Día Gratis',
        badgeLabel: 'Gratis',
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.05)',
        description: 'Día libre de cobro.',
        isRealPayment: false,
        isFree: true
    },
    PENDING: {
        label: 'Día Pendiente',
        badgeLabel: 'Pendiente',
        color: '#eab308',
        bg: 'rgba(234,179,8,0.05)',
        description: 'Factura pendiente por cobro.',
        isRealPayment: false,
        isFree: false
    },
    DEBT: {
        label: 'Día en Deuda',
        badgeLabel: 'Deuda',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.03)',
        description: 'Día no pagado en mora / deuda.',
        isRealPayment: false,
        isFree: false
    },
    NEQUI: {
        label: 'Pago Real - Nequi',
        badgeLabel: 'NEQUI',
        color: '#E11D48',
        bg: '#FFF1F2',
        description: 'Pago real recibido vía Nequi.',
        autoAmount: null,
        autoReference: 'Pago Nequi recibido por Admin',
        isRealPayment: true,
        isFree: false
    },
    EFECTIVO: {
        label: 'Pago Real - Efectivo',
        badgeLabel: 'EFECTIVO',
        color: '#16A34A',
        bg: '#F0FDF4',
        description: 'Pago real recibido en efectivo.',
        autoAmount: null,
        autoReference: 'Pago en Efectivo recibido por Admin',
        isRealPayment: true,
        isFree: false
    },
    TRANSFERENCIA: {
        label: 'Pago Real - Transferencia Bancaria',
        badgeLabel: 'TRANSFERENCIA',
        color: '#2563EB',
        bg: '#EFF6FF',
        description: 'Pago real recibido por transferencia bancaria.',
        autoAmount: null,
        autoReference: 'Transferencia Bancaria recibida por Admin',
        isRealPayment: true,
        isFree: false
    },
    ACCIDENT_TRANSIT: {
        label: 'Ajuste - Retenida en tránsito por accidente ($0)',
        badgeLabel: 'TRANSITO',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'RETENIDA EN TRÁNSITO POR ACCIDENTE - Día ajustado automáticamente',
        isRealPayment: false,
        isFree: true
    },
    REPAIR: {
        label: 'Ajuste - Retenida en tránsito por accidente ($0)',
        badgeLabel: 'RETENIDA',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'RETENIDA EN TRÁNSITO POR ACCIDENTE - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    INCAPACITY: {
        label: 'Ajuste - Incapacidad ($0)',
        badgeLabel: 'INCAPACIDAD',
        color: '#3b82f6',
        bg: '#EFF6FF',
        description: 'Incapacidad médica del cliente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'INCAPACIDAD - Día ajustado automáticamente',
        isRealPayment: false,
        isFree: true
    },
    MAINTENANCE: {
        label: 'Ajuste - Mantenimiento ($0)',
        badgeLabel: 'MANTENIMIENTO',
        color: '#7460EE',
        bg: '#F5F3FF',
        description: 'Mantenimiento programado — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'MANTENIMIENTO - Día ajustado automáticamente',
        isRealPayment: false,
        isFree: true
    },
    ADJUSTMENT: {
        label: 'Ajuste - Oficina ($0)',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'OFICINA - Día ajustado automáticamente',
        isRealPayment: false,
        isFree: true
    },
    OFFICE: {
        label: 'Ajuste - Oficina ($0)',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'OFICINA - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    OFICINA: {
        label: 'Ajuste - Oficina ($0)',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'OFICINA - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    WORKSHOP: {
        label: 'Ajuste - Taller ($0)',
        badgeLabel: 'TALLER',
        color: '#A3A3A3',
        bg: '#F5F5F5',
        description: 'Dispositivo en taller — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'TALLER - Día ajustado automáticamente',
        isRealPayment: false,
        isFree: true
    },
    TALLER: {
        label: 'Ajuste - Taller ($0)',
        badgeLabel: 'TALLER',
        color: '#A3A3A3',
        bg: '#F5F5F5',
        description: 'Dispositivo en taller — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'TALLER - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    MANTENIMIENTO: {
        label: 'Ajuste - Mantenimiento ($0)',
        badgeLabel: 'MANTENIMIENTO',
        color: '#7460EE',
        bg: '#F5F3FF',
        description: 'Mantenimiento programado — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'MANTENIMIENTO - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    INCAPACIDAD: {
        label: 'Ajuste - Incapacidad ($0)',
        badgeLabel: 'INCAPACIDAD',
        color: '#3b82f6',
        bg: '#EFF6FF',
        description: 'Incapacidad médica del cliente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'INCAPACIDAD - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    TRANSITO: {
        label: 'Ajuste - Retenida en tránsito por accidente ($0)',
        badgeLabel: 'TRANSITO',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'RETENIDA EN TRÁNSITO POR ACCIDENTE - Día ajustado automáticamente',
        hidden: true,
        isRealPayment: false,
        isFree: true
    }
};

class SettingRepository {
    async getSetting(key, defaultValue = null) {
        try {
            const setting = await Setting.findOne({ key }).lean();
            if (setting) return setting.value;

            if (key === 'adjustment_types') {
                await this.setSetting('adjustment_types', DEFAULT_ADJUSTMENT_TYPES, 'Tipos de pagos y ajustes de facturas');
                return DEFAULT_ADJUSTMENT_TYPES;
            }

            return defaultValue;
        } catch (error) {
            logger.error(`Error getting setting key '${key}':`, error);
            if (key === 'adjustment_types') return DEFAULT_ADJUSTMENT_TYPES;
            return defaultValue;
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

    async getAdjustmentTypes() {
        const stored = await this.getSetting('adjustment_types', DEFAULT_ADJUSTMENT_TYPES);
        const merged = { ...DEFAULT_ADJUSTMENT_TYPES, ...(stored || {}) };
        return merged;
    }

    async updateAdjustmentTypes(typesData) {
        return this.setSetting('adjustment_types', typesData, 'Tipos de pagos y ajustes de facturas');
    }
}

export default new SettingRepository();
