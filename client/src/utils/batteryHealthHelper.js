/**
 * Battery & Alternator Fleet Diagnostic Helper
 * Calcula el diagnóstico incremental de batería y alternador/carga para los dispositivos.
 */

export const BATTERY_STATUS = {
    HEALTHY: 'HEALTHY',     // >= 12.3V reposo
    WEAK: 'WEAK',           // 11.8V - 12.2V o fuga parásita
    DAMAGED: 'DAMAGED',     // < 11.8V en reposo o celda rota (<9V)
    POWER_CUT: 'POWER_CUT', // Sin alimentación externa
    UNKNOWN: 'UNKNOWN'
};

export const ALTERNATOR_STATUS = {
    CHARGING_OK: 'CHARGING_OK',                     // 13.6V - 14.8V en marcha
    REGULATOR_OVERVOLTAGE: 'REGULATOR_OVERVOLTAGE', // >= 15.0V (regulador perforado)
    NO_CHARGE: 'NO_CHARGE',                         // En marcha pero no supera 12.8V
    WEAK_CHARGE: 'WEAK_CHARGE',                     // En marcha entre 12.9V - 13.4V
    OFF: 'OFF',                                     // Motor apagado (alternador en reposo)
    UNKNOWN: 'UNKNOWN'
};

/**
 * Obtiene el diagnóstico instantáneo para un dispositivo basado en telemetría en vivo
 * @param {Object} device 
 */
export function getDeviceElectricalHealth(device) {
    if (!device) return { battery: BATTERY_STATUS.UNKNOWN, alternator: ALTERNATOR_STATUS.UNKNOWN, voltage: null };

    const voltage = typeof device.voltage === 'number' ? device.voltage : (device.telemetry?.voltage ?? null);
    const ignition = Boolean(device.ignition);
    const powerCut = Boolean(device.powerCut);
    const motion = Boolean(device.motion || (device.speed && device.speed > 3));

    // 1. Diagnóstico de Batería
    let batteryStatus = BATTERY_STATUS.HEALTHY;
    let batteryDetails = 'Batería en estado óptimo';

    if (powerCut) {
        batteryStatus = BATTERY_STATUS.POWER_CUT;
        batteryDetails = '¡Alerta! Batería principal desconectada o fusible fundido';
    } else if (voltage !== null) {
        if (voltage < 9.0) {
            batteryStatus = BATTERY_STATUS.DAMAGED;
            batteryDetails = `Celda rota o colapso severo (${voltage.toFixed(1)}V < 9.0V)`;
        } else if (voltage < 11.8) {
            batteryStatus = BATTERY_STATUS.DAMAGED;
            batteryDetails = `Batería degradada en descarga profunda (${voltage.toFixed(1)}V < 11.8V)`;
        } else if (voltage < 12.3) {
            batteryStatus = BATTERY_STATUS.WEAK;
            batteryDetails = `Batería baja / capacidad reducida (${voltage.toFixed(1)}V)`;
        } else {
            batteryStatus = BATTERY_STATUS.HEALTHY;
            batteryDetails = `Batería con carga óptima (${voltage.toFixed(1)}V)`;
        }
    } else if (device.batteryLevel !== null && device.batteryLevel !== undefined) {
        if (device.batteryLevel <= 20) {
            batteryStatus = BATTERY_STATUS.DAMAGED;
            batteryDetails = `Batería crítica (${device.batteryLevel}%)`;
        } else if (device.batteryLevel <= 40) {
            batteryStatus = BATTERY_STATUS.WEAK;
            batteryDetails = `Batería baja (${device.batteryLevel}%)`;
        } else {
            batteryStatus = BATTERY_STATUS.HEALTHY;
            batteryDetails = `Batería normal (${device.batteryLevel}%)`;
        }
    }

    // 2. Diagnóstico de Alternador / Regulador
    let alternatorStatus = ALTERNATOR_STATUS.OFF;
    let alternatorDetails = 'Motor apagado (alternador inactivo)';

    if (ignition) {
        if (voltage !== null) {
            if (voltage >= 15.0) {
                alternatorStatus = ALTERNATOR_STATUS.REGULATOR_OVERVOLTAGE;
                alternatorDetails = `¡PELIGRO! Sobrevoltaje en regulador (${voltage.toFixed(1)}V >= 15.0V)`;
            } else if (motion && voltage < 12.8) {
                alternatorStatus = ALTERNATOR_STATUS.NO_CHARGE;
                alternatorDetails = `¡Alerta! Alternador inoperativo en marcha (${voltage.toFixed(1)}V)`;
            } else if (motion && voltage < 13.5) {
                alternatorStatus = ALTERNATOR_STATUS.WEAK_CHARGE;
                alternatorDetails = `Carga insuficiente del alternador (${voltage.toFixed(1)}V < 13.5V)`;
            } else {
                alternatorStatus = ALTERNATOR_STATUS.CHARGING_OK;
                alternatorDetails = `Sistema de carga funcionando normal (${voltage.toFixed(1)}V)`;
            }
        } else {
            alternatorStatus = ALTERNATOR_STATUS.CHARGING_OK;
            alternatorDetails = 'Motor encendido (generando carga)';
        }
    }

    return {
        batteryStatus,
        batteryDetails,
        alternatorStatus,
        alternatorDetails,
        voltage
    };
}

/**
 * Calcula el resumen de salud eléctrica para toda la flota de dispositivos
 * @param {Array} devices 
 */
export function calculateFleetElectricalSummary(devices = []) {
    const summary = {
        total: devices.length,
        healthy: 0,
        weak: 0,
        damaged: 0,
        powerCut: 0,
        overvoltage: 0,
        noCharge: 0,
        weakCharge: 0,
        healthPercentage: 100
    };

    if (!devices.length) return summary;

    devices.forEach(dev => {
        const { batteryStatus, alternatorStatus } = getDeviceElectricalHealth(dev);

        if (batteryStatus === BATTERY_STATUS.HEALTHY) summary.healthy++;
        else if (batteryStatus === BATTERY_STATUS.WEAK) summary.weak++;
        else if (batteryStatus === BATTERY_STATUS.DAMAGED) summary.damaged++;
        else if (batteryStatus === BATTERY_STATUS.POWER_CUT) summary.powerCut++;

        if (alternatorStatus === ALTERNATOR_STATUS.REGULATOR_OVERVOLTAGE) summary.overvoltage++;
        else if (alternatorStatus === ALTERNATOR_STATUS.NO_CHARGE) summary.noCharge++;
        else if (alternatorStatus === ALTERNATOR_STATUS.WEAK_CHARGE) summary.weakCharge++;
    });

    summary.healthPercentage = summary.total > 0
        ? Math.round((summary.healthy / summary.total) * 100)
        : 100;

    return summary;
}

