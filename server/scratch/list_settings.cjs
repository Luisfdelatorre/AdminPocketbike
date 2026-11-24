const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike?directConnection=true');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    for (const c of collections) {
        if (c.name.includes('setting')) {
            const docs = await db.collection(c.name).find().toArray();
            console.log(c.name, 'count:', docs.length, docs.map(d => d.key || d.name || d._id));
        }
    }
    await mongoose.disconnect();
}
run();

