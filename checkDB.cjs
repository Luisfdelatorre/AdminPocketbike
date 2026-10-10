const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike');
  const collection = mongoose.connection.collection('companies');
  const companies = await collection.find({}).toArray();
  console.log(companies.map(c => ({ name: c.name, strategy: c.cutOffStrategy, time: c.cutOffTime })));
  process.exit(0);
}

check();
