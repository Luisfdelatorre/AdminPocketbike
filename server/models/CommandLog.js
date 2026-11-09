import mongoose from 'mongoose';

export const COMMAND_TYPE = {
    RESUME: 'RESUME', // Habilitar encendido
    STOP: 'STOP',     // Corte de motor / apagado
    PREVENTIVE: 'PREVENTIVE' // Bloqueo preventivo
};

export const COMMAND_SOURCE = {
    SYSTEM: 'SYSTEM', // Upay System, cron, pago automático
    MANUAL: 'MANUAL'  // Admin desde plataforma
};

export const COMMAND_STATUS = {
    EXECUTED: 'EXECUTED', // Confirmado GPS / Ejecutado
    QUEUED: 'QUEUED',     // En cola GPRS
    FAILED: 'FAILED'      // Error / Timeout
};

const commandLogSchema = new mongoose.Schema({
    deviceIdName: { type: String, required: true, uppercase: true, trim: true, index: true },
    deviceId: { type: String, default: null },
    gpsId: { type: String, default: null, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
    companyName: { type: String, default: null },
    commandType: { 
        type: String, 
        enum: Object.values(COMMAND_TYPE), 
        required: true, 
        index: true 
    },
    rawCommand: { type: String, default: null }, // e.g. 'engineResume', 'engineStop'
    source: { 
        type: String, 
        enum: Object.values(COMMAND_SOURCE), 
        default: COMMAND_SOURCE.MANUAL, 
        index: true 
    },
    senderName: { type: String, default: 'Upay System' },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { 
        type: String, 
        enum: Object.values(COMMAND_STATUS), 
        default: COMMAND_STATUS.EXECUTED, 
        index: true 
    },
    latencyMs: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    details: { type: String, default: '' },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    sentAt: { type: Date, default: Date.now, index: true }
}, {
    timestamps: true
});

commandLogSchema.index({ companyId: 1, sentAt: -1 });
commandLogSchema.index({ deviceIdName: 1, sentAt: -1 });

export const CommandLog = mongoose.model('CommandLog', commandLogSchema);
export default CommandLog;

