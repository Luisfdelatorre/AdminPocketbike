const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27018/payments-wompi-pocketbike?authSource=admin', { directConnection: true });
        const doc = await mongoose.connection.db.collection('settings').findOne({ key: 'adjustment_types' });
        const val = doc.value;
        val.NEQUI = {
            label: 'Pago Real - Nequi',
            badgeLabel: 'NEQUI',
            color: '#E11D48',
            bg: '#FFF1F2',
            description: 'Pago real recibido vía Nequi.',
            autoAmount: null,
            autoReference: 'NEQUI - {deviceName} ({date})',
            isRealPayment: true,
            isFree: false,
            hidden: true,
            category: 'ADJUSTMENT'
        };
        await mongoose.connection.db.collection('settings').updateOne(
            { key: 'adjustment_types' },
            { $set: { value: val, updatedAt: new Date() } }
        );
        console.log('Successfully saved NEQUI with hidden: true in MongoDB!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

