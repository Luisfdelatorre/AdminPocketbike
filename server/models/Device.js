import mongoose from 'mongoose';
import { Transaction } from '../config/config.js';
const { DEFAULTAMOUNT } = Transaction;

function generateDeviceId(plate) {
    const p = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!p) return null;

    const r = p.split("").reverse().join(""); // e.g. G83JHZ
    const a = r.charCodeAt(0) - 55;     // base36
    const d5 = r.charCodeAt(1) - 48; // base10
    const d4 = r.charCodeAt(2) - 48; // base10
    const c = r.charCodeAt(3) - 55;     // base36
    const b = r.charCodeAt(4) - 55;     // base36
    const z = r.charCodeAt(5) - 55;     // base36

    return (((((a * 10 + d5) * 10 + d4) * 36 + c) * 36 + b) * 36 + z);
}

const deviceSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed, required: true, default: function () { return (this && this.name) ? generateDeviceId(this.name) : new mongoose.Types.ObjectId(); } }, // Custom ID based on name or ObjectId
    name: { type: String, unique: true }, //plate
    model: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'maintenance', 'online'], default: 'active', },
    disabled: { type: Boolean, default: false },
    lastUpdate: { type: Date },
    positionId: { type: Number },
    companyId: { type: String, index: true },
    companyName: { type: String, },
    contractId: { type: String, },
    deviceId: { type: Number, default: function () { return (this && this.name) ? generateDeviceId(this.name) : null; } },
    driverName: { type: String },
    gpsId: { type: mongoose.Schema.Types.Mixed, required: true }, // Mixed: Traccar can return numeric or string IDs depending on version/config
    imei: { type: String, default: null },
    deviceType: { type: String },//groupId traccar
    category: { type: String, default: null },//car moto//icon 
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    notes: { type: String, default: '', },
    // online: { type: Boolean, default: false },//diff < Transaction.DEVICE_ONLINE_TIMEOUT;
    cutOff: { type: Number, default: 0 },// 1 cuando attributes.status === 133
    ignition: { type: Boolean, default: false, },// sensors.ignition
    batteryLevel: { type: Number, default: null, },// attributes.batteryLevel (0–100)
    //BACKWARD COMPATIBILITY //TRACCAR
    nequiNumber: { type: String, default: null },//phone // nequi
    simCardNumber: { type: String, default: null },//contact//simCard: { name}
    // uniqueId: { type: String, default: null },//uniqueId traccar
    groupId: { type: Number },//companyGroup in traccar
    calendarId: { type: Number },
    category: { type: String, default: null },
    expirationTime: { type: Date, default: null },
    freeDaysUsed: { type: Number, default: 0 },
    phone: { type: String }, // nequi
    contact: { type: String }, // simCard
    activeContractId: { type: String, default: null }, // Denormalized: ID of the current active contract
    hasActiveContract: { type: Boolean, default: false, index: true }, // Denormalized: Easy query flag
    dailyRate: { type: Number, default: 0 }, // Denormalized: Current active daily rate
    exemptFromCutOff: { type: Boolean, default: false }, // Syncs from Contract — exempt from payment-based daily engine stop
    exemptFromCurfew: { type: Boolean, default: false }, // Syncs from Contract — exempt from nightly curfew (toque de queda)
    cutOffTime: { type: String, default: null }, // Synced from active Contract
    curfewStatus: { type: Boolean, default: false }, // True if currently forced OFF by curfew
    attributes: {
        Cuota: { type: Number, default: DEFAULTAMOUNT },
        DailyPayment: { type: Boolean, default: false },
        FreeDays: { type: Number, default: 4 },
        Contrato: { type: Number, default: 500 },
    },
}, {
    timestamps: true,
});

deviceSchema.index({ hasActiveContract: 1, cutOff: 1, cutOffTime: 1 });

export const Device = mongoose.model('Device', deviceSchema);
