import mongoose from 'mongoose';
import { Invoice } from './server/models/Invoice.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pocketbike');
  const invoices = await Invoice.find({ deviceIdName: 'ILJ66H' }).sort({ date: -1 }).limit(10).lean();
  console.log(invoices.map(i => ({ date: i.date, dayType: i.dayType, amount: i.amount, paidAmount: i.paidAmount, paid: i.paid })));
  process.exit(0);
}
run();
