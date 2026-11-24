import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import { Contract } from '../models/Contract.js';
import { Invoice } from '../models/Invoice.js';
import dayjs from '../config/dayjs.js';

async function simulate() {
    await mongoose.connect(MongoDB.URI);

    const contract = await Contract.findOne({ contractId: 'CIPMQ44ITV' });
    console.log('Contract:', contract.contractId, 'frequency:', contract.paymentFrequency, 'policy:', contract.freeDayPolicy, 'fixedFreeDay:', contract.fixedFreeDayOfWeek);

    const rawLimit = contract.getBillingMultiplier();
    const targetLimit = rawLimit || contract.paymentFrequency || 1;
    console.log('targetLimit:', targetLimit);

    // Let us check what findLastPaid returned after 2026-11-21 was paid
    // Before 2026-11-22 was paid, the last paid was 2026-11-21:
    const latestPaidDate = dayjs('2026-11-21T05:00:00.000Z');
    let currentDate = latestPaidDate.add(1, 'day');
    console.log('currentDate:', currentDate.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('currentDate dayOfWeek (day()):', currentDate.day());
    console.log('isFixedFreeDay(currentDate):', contract.isFixedFreeDay(currentDate));

    // Wait! Let us check what findOrCreateInvoiceByName does:
    const id = Invoice.buildId('PMQ44I', currentDate.toDate());
    console.log('Invoice ID:', id);

    // Wait! Check how the invoice date is stored and compared:
    console.log('currentDate.toDate():', currentDate.toDate());
    console.log('currentDate.toDate().getDay():', currentDate.toDate().getDay());

    await mongoose.disconnect();
}

simulate();
