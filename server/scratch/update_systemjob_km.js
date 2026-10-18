import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function updateJob() {
  await mongoose.connect(MongoDB.URI);
  const res = await mongoose.connection.db.collection('systemjobs').updateOne(
    { job: { $in: ['syncYesterdayKm', 'syncDailyKm'] } },
    { $set: { name: 'syncDailyKm', job: 'syncDailyKm', time: '59 23 * * *', log: 'Call one time a day daily km sync at 23:59' } }
  );
  console.log('Update result:', res);
  const jobs = await mongoose.connection.db.collection('systemjobs').find({}).toArray();
  console.log(jobs.map(j => ({ _id: j._id, name: j.name, job: j.job, time: j.time, flag: j.flag })));
  await mongoose.disconnect();
}

updateJob().catch(console.error);
