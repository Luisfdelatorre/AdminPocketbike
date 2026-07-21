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

/*function generateDeviceId(plate) {
    const p = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!p) return null;

    // Pad to 6 chars so charCodeAt never returns NaN on short plates
    const r = p.padEnd(6, '0').split("").reverse().join(""); // e.g. ABC123 → 321CBA

    const LETTER = 'A'.charCodeAt(0) - 10; // 55 — converts letter charCode to base36 digit (A→10, B→11 … Z→35)
    const DIGIT  = '0'.charCodeAt(0);       // 48 — converts digit  charCode to base10 value  (0→0,  9→9)

    // Math.max(0, …) guards against a digit landing in a letter slot (would go negative)
    const a  = Math.max(0, r.charCodeAt(0) - LETTER); // base36
    const d5 = Math.max(0, r.charCodeAt(1) - DIGIT);  // base10
    const d4 = Math.max(0, r.charCodeAt(2) - DIGIT);  // base10
    const c  = Math.max(0, r.charCodeAt(3) - LETTER); // base36
    const b  = Math.max(0, r.charCodeAt(4) - LETTER); // base36
    const z  = Math.max(0, r.charCodeAt(5) - LETTER); // base36

    const id = (((((a * 10 + d5) * 10 + d4) * 36 + c) * 36 + b) * 36 + z);
    return Number.isFinite(id) ? id : null;
}*/


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

/**
 * Static helper: prepares raw GPS docs for bulkWrite.
 * Generates the deterministic numeric _id from the plate name and
 * strips empty objects that GPS APIs sometimes return.
 * Called in the repository because bulkWrite bypasses Mongoose middleware and defaults.
 */
deviceSchema.statics.prepareForBulkWrite = function (docs) {
    return docs.map(doc => {
        const id = generateDeviceId(doc.name);
        return Object.fromEntries(
            Object.entries({ ...doc, _id: id, id })
                .filter(([, v]) =>
                    !(v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
                )
        );
    });
};

export const Device = mongoose.model('Device', deviceSchema);
export { generateDeviceId };
