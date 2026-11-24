import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';
import { Contract } from '../models/Contract.js';
import dayjs from '../config/dayjs.js';

async function main() {
    await mongoose.connect(MongoDB.URI);

    const contract = await Contract.findOne({ contractId: 'CIPMQ44ITV' });
    console.log('Contract CIPMQ44ITV:');
    console.log('  paymentFrequency:', contract.paymentFrequency);
    console.log('  freeDayPolicy:', contract.freeDayPolicy);
    console.log('  fixedFreeDayOfWeek:', contract.fixedFreeDayOfWeek);
    console.log('  freeDaysLimit:', contract.freeDaysLimit);

    const sundayDate = dayjs('2026-11-22T05:00:00.000Z');
    console.log('Sunday Nov 22:');
    console.log('  dayjs.day():', sundayDate.day());
    console.log('  contract.isFixedFreeDay(sundayDate):', contract.isFixedFreeDay(sundayDate));
    console.log('  contract.isFixedFreeDay(sundayDate.toDate()):', contract.isFixedFreeDay(sundayDate.toDate()));

    const saturdayDate = dayjs('2026-11-21T05:00:00.000Z');
    console.log('Saturday Nov 21:');
    console.log('  dayjs.day():', saturdayDate.day());
    console.log('  contract.isFixedFreeDay(saturdayDate):', contract.isFixedFreeDay(saturdayDate));

    // Also check what getBillingMultiplier returns
    console.log('  contract.getBillingMultiplier():', contract.getBillingMultiplier());
    console.log('  Contract.getBillingMultiplier(contract.paymentFrequency, contract.freeDayPolicy):',
        Contract.getBillingMultiplier(contract.paymentFrequency, contract.freeDayPolicy));

    await mongoose.disconnect();
}

main();
