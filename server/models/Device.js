import mongoose from 'mongoose';
import { Transaction } from '../config/config.js';
const { DEFAULTAMOUNT } = Transaction;

const deviceSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed, required: true }, // External system ID (String or Number)
    name: { type: String, unique: true }, //plate
    model: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active', },
    disabled: { type: Boolean, default: false },
    lastUpdate: { type: Date },
    positionId: { type: Number },
    companyId: { type: String, required: true },
    companyName: { type: String, required: true },
    contractId: { type: String, required: true },
    driverName: { type: String, required: true },
    deviceId: { type: String, required: true },
    webDeviceId: { type: Number, default: null },
    imei: { type: String, default: null },
    deviceType: { type: String },//groupId traccar
    category: { type: String, default: null },//car moto//icon 
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    notes: { type: String, default: '', },
    // online: { type: Boolean, default: false },//diff < Transaction.DEVICE_ONLINE_TIMEOUT;
    cutOff: { type: Number, default: 0, },// 1 cuando attributes.status === 133
    ignition: { type: Boolean, default: false, },// sensors.ignition
    batteryLevel: { type: Number, default: null, },// attributes.batteryLevel (0–100)
    //BACKWARD COMPATIBILITY //TRACCAR
    nequiNumber: { type: String, default: null },//phone // nequi
    simCardNumber: { type: String, default: null },//contact//simCard: { name}
    uniqueId: { type: String, default: null },//uniqueId traccar
    groupId: { type: Number },//companyGroup in traccar
    calendarId: { type: Number },
    category: { type: String, default: null },
    expirationTime: { type: Date, default: null },
    freeDaysUsed: { type: Number, default: 0 },
    phone: { type: String }, // nequi
    contact: { type: String }, // simCard
    activeContractId: { type: String, default: null }, // Denormalized: ID of the current active contract
    hasActiveContract: { type: Boolean, default: false }, // Denormalized: Easy query flag
    attributes: {
        Cuota: { type: Number, default: DEFAULTAMOUNT },
        DailyPayment: { type: Boolean, default: false },
        FreeDays: { type: Number, default: 2 },
        Contrato: { type: Number, default: 520 },
    },
}, {
    timestamps: true,
});

export const Device = mongoose.model('Device', deviceSchema);
