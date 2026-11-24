const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike?directConnection=true');
    const db = mongoose.connection.db;
    const settings = await db.collection('settings').find({ key: { $in: ['adjustmentTypes', 'paymentStatuses'] } }).toArray();
    console.log(JSON.stringify(settings, null, 2));
    await mongoose.disconnect();
}
run();

