import mongoose from 'mongoose';

export const ALERT_TYPE = {
    POWER_CUT: 'POWER_CUT',                         // Corte de batería / alimentación externa
    UNAUTHORIZED_MOVEMENT: 'UNAUTHORIZED_MOVEMENT', // Alarma de vibración/movimiento con motor bloqueado
    UNAUTHORIZED_IGNITION: 'UNAUTHORIZED_IGNITION', // Switch encendido con motor en corte
    GEOFENCE_EXIT: 'GEOFENCE_EXIT',                 // Salida de geocerca autorizada
    EXTENDED_OFFLINE: 'EXTENDED_OFFLINE'            // Desconexión / offline prolongado
};

export const ALERT_SEVERITY = {
    CRITICAL: 'CRITICAL', // Rojo (Power Cut, Movimiento, Ignición)
    WARNING: 'WARNING',   // Amarillo / Ámbar (Geocerca, Offline)
    INFO: 'INFO'          // Azul
};

export const ALERT_STATUS = {
    ACTIVE: 'ACTIVE',               // Activa / Pendiente de atención
    ACKNOWLEDGED: 'ACKNOWLEDGED',   // Vista / En gestión
    RESOLVED: 'RESOLVED'            // Atendida / Resuelta
};

const alertLogSchema = new mongoose.Schema({
    deviceIdName: { 
        type: String, 
        required: true, 
        uppercase: true, 
        trim: true, 
        index: true 
    },
    deviceId: { type: mongoose.Schema.Types.Mixed, default: null },
    gpsId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
    companyId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
    companyName: { type: String, default: null },
    alertType: { 
        type: String, 
        enum: Object.values(ALERT_TYPE), 
        required: true, 
        index: true 
    },
    severity: { 
        type: String, 
        enum: Object.values(ALERT_SEVERITY), 
        default: ALERT_SEVERITY.CRITICAL, 
        index: true 
    },
    status: { 
        type: String, 
        enum: Object.values(ALERT_STATUS), 
        default: ALERT_STATUS.ACTIVE, 
        index: true 
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    location: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: null },
        speed: { type: Number, default: 0 }
    },
    metadata: {
        cutOff: { type: Boolean, default: null },
        ignition: { type: Boolean, default: null },
        motion: { type: Boolean, default: null },
        batteryLevel: { type: Number, default: null },
        hoursOffline: { type: Number, default: null },
        rawAlarm: { type: String, default: null },
        rawEvent: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    occurrenceCount: { type: Number, default: 1 },
    lastSeenAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: {
        userId: { type: String, default: null },
        name: { type: String, default: null },
        username: { type: String, default: null }
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
        userId: { type: String, default: null },
        name: { type: String, default: null },
        username: { type: String, default: null }
    },
    resolutionNotes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true }
}, {
    timestamps: true
});

alertLogSchema.index({ companyId: 1, timestamp: -1 });
alertLogSchema.index({ companyId: 1, status: 1, timestamp: -1 });
alertLogSchema.index({ deviceIdName: 1, timestamp: -1 });
alertLogSchema.index({ alertType: 1, timestamp: -1 });

export const AlertLog = mongoose.model('AlertLog', alertLogSchema);
export default AlertLog;
