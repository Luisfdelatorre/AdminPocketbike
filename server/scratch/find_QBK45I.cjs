const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27018/payments-wompi-pocketbike?authSource=admin', { directConnection: true });
        const cols = await mongoose.connection.db.listCollections().toArray();
        for (const col of cols) {
            try {
                const sample = await mongoose.connection.db.collection(col.name).findOne({
                    $or: [
                        { deviceId: 'QBK45I' },
                        { deviceName: 'QBK45I' },
                        { plate: 'QBK45I' },
                        { name: 'QBK45I' },
                        { invoiceId: /QBK45I/i },
                        { paymentReference: /QBK45I/i },
                        { reference: /QBK45I/i }
                    ]
                });
                if (sample) {
                    console.log(`Found in collection: ${col.name}!`);
                    console.log(JSON.stringify(sample, null, 2));
                }
            } catch (e) {
                // Ignore collection query errors
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

