import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function inspect() {
  await mongoose.connect(MongoDB.URI);
  const invoices = await mongoose.connection.db.collection('invoices').find({
    invoiceId: { $regex: 'YIE06H' }
  }).sort({ date: -1 }).limit(10).toArray();

  console.log('Invoices for YIE06H:');
  console.log(JSON.stringify(invoices.map(i => ({
    _id: i._id,
    invoiceId: i.invoiceId,
    date: i.date,
    distance: i.distance,
    amount: i.amount,
    status: i.status
  })), null, 2));

  // Also check device details
  const device = await mongoose.connection.db.collection('devices').findOne({ name: 'YIE06H' });
  console.log('Device YIE06H:', {
    _id: device?._id,
    name: device?.name,
    gpsId: device?.gpsId,
    companyId: device?.companyId,
    telemetry: device?.telemetry
  });

  await mongoose.disconnect();
}

inspect().catch(console.error);
