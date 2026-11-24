const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike?directConnection=true');
    const db = mongoose.connection.db;
    const doc = await db.collection('settings').findOne({ key: 'payment_status' });
    console.log(JSON.stringify(doc, null, 2));
    await mongoose.disconnect();
}
run();

