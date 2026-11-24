const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike?directConnection=true');
    const doc = await mongoose.connection.db.collection('settings').findOne({ key: 'adjustment_types' });
    for (const [k, v] of Object.entries(doc.value || {})) {
        if (v.hidden) {
            console.log('HIDDEN KEY:', k, v);
        } else {
            console.log('VISIBLE KEY:', k);
        }
    }
    await mongoose.disconnect();
}
run();

