/**
 * Script: Add missing system statuses to the payment_status setting in MongoDB.
 * 
 * This merges new status entries into the existing DB document WITHOUT
 * overwriting styles that have already been customized by the user.
 * 
 * Usage: node server/scratch/add_missing_statuses.js
 * Requires: npm run dev:db-tunnel active
 */
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

const NEW_STATUSES = {
    FREEPASS: {
        label: 'Pase Libre',
        badgeLabel: 'PASE LIBRE',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.06)',
        description: 'Pase libre temporal (ej: 24h post-pago).',
        isRealPayment: false,
        isFree: true,
        category: 'STATUS'
    },
    CONFIRMING: {
        label: 'Confirmando',
        badgeLabel: 'CONFIRMANDO',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.06)',
        description: 'Pago iniciado, esperando confirmación final.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    VERIFYING: {
        label: 'Verificando',
        badgeLabel: 'VERIFICANDO',
        color: '#d97706',
        bg: 'rgba(217,119,6,0.06)',
        description: 'Estado intermedio durante verificación de pago.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    LOAN: {
        label: 'Préstamo',
        badgeLabel: 'PRÉSTAMO',
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.06)',
        description: 'Trabajar hoy, pagar después.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    DECLINED: {
        label: 'Rechazado',
        badgeLabel: 'RECHAZADO',
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.04)',
        description: 'Transacción rechazada por el banco o pasarela.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    ERROR: {
        label: 'Error',
        badgeLabel: 'ERROR',
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.04)',
        description: 'Error técnico durante la transacción.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    VOIDED: {
        label: 'Anulado',
        badgeLabel: 'ANULADO',
        color: '#6b7280',
        bg: 'rgba(107,114,128,0.06)',
        description: 'Transacción cancelada o anulada.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    INITIAL_FEE: {
        label: 'Cuota Inicial',
        badgeLabel: 'CUOTA INICIAL',
        color: '#0d9488',
        bg: 'rgba(13,148,136,0.06)',
        description: 'Cuota inicial del contrato.',
        isRealPayment: true,
        isFree: false,
        category: 'STATUS'
    }
};

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const col = db.collection('settings');

    const doc = await col.findOne({ key: 'payment_status' });

    if (!doc) {
        console.log('No payment_status setting found in DB. The defaults will be used on next server start.');
        await mongoose.disconnect();
        return;
    }

    const current = doc.value || {};
    let added = 0;

    for (const [key, val] of Object.entries(NEW_STATUSES)) {
        if (!current[key]) {
            current[key] = val;
            added++;
            console.log(`  + Added: ${key} (${val.badgeLabel})`);
        } else {
            console.log(`  ✓ Already exists: ${key}`);
        }
    }

    if (added > 0) {
        await col.updateOne(
            { key: 'payment_status' },
            { $set: { value: current } }
        );
        console.log(`\n✅ Updated payment_status in DB — ${added} new statuses added.`);
    } else {
        console.log('\n✅ All statuses already present. No changes needed.');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
