import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import { MongoDB } from '../config/config.js';

async function migrate() {
    console.log('Connecting to actual database:', MongoDB.URI);
    await mongoose.connect(MongoDB.URI);
    console.log('Connected to:', mongoose.connection.db.databaseName);

    const existingAdj = await Setting.findOne({ key: 'adjustment_types' }).lean();
    if (!existingAdj) {
        console.log('No adjustment_types found in DB.');
        await mongoose.disconnect();
        return;
    }

    console.log('Found adjustment_types document ID:', existingAdj._id);
    const currentData = existingAdj.value || {};
    const statusKeys = ['PAID', 'FREE', 'PENDING', 'DEBT'];

    const paymentStatusObj = {};
    const adjustmentTypesObj = {};

    Object.entries(currentData).forEach(([key, val]) => {
        if (statusKeys.includes(key)) {
            paymentStatusObj[key] = {
                ...val,
                category: 'STATUS'
            };
        } else {
            adjustmentTypesObj[key] = {
                ...val,
                category: 'ADJUSTMENT'
            };
        }
    });

    console.log('payment_status keys to save:', Object.keys(paymentStatusObj));
    console.log('adjustment_types keys to save:', Object.keys(adjustmentTypesObj));

    // Save payment_status
    const savedPaymentStatus = await Setting.findOneAndUpdate(
        { key: 'payment_status' },
        {
            $set: {
                key: 'payment_status',
                value: paymentStatusObj,
                description: 'Estados contables del ciclo de facturación'
            }
        },
        { upsert: true, new: true, lean: true }
    );
    console.log('✅ payment_status saved with ID:', savedPaymentStatus._id);

    // Update adjustment_types with only adjustments
    const updatedAdj = await Setting.findOneAndUpdate(
        { key: 'adjustment_types' },
        {
            $set: {
                value: adjustmentTypesObj,
                description: 'Tipos de pagos y ajustes de facturas'
            }
        },
        { new: true, lean: true }
    );
    console.log('✅ adjustment_types updated with ID:', updatedAdj._id);
    console.log('New adjustment_types keys in DB:', Object.keys(updatedAdj.value));

    await mongoose.disconnect();
    console.log('Migration completed successfully.');
}

migrate().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});
