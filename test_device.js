import mongoose from 'mongoose';
import { Device } from './server/models/Device.js';

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/pocketbike');
    const devices = await Device.find({}).limit(5).lean();
    console.log('Devices in DB:', devices.map(d => ({ _id: d._id, id: d.id, deviceId: d.deviceId, name: d.name, gpsId: d.gpsId })));
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}
run();
