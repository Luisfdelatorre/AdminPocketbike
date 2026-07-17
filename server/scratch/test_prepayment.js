import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import paymentService from '../services/paymentService.js';
import companyService from '../services/companyService.js';
import helpers from '../utils/helpers.js';
import { Company } from '../models/Company.js';
import { Device } from '../models/Device.js';
import { Contract } from '../models/Contract.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import dayjs from '../config/dayjs.js';

async function runTest() {
    console.log('🏁 Starting Prepayment and Free Sunday Logic Verification...');
    
    // Connect to DB
    await connectDatabase();
    
    const testDeviceName = 'BIKETEST999';
    
    try {
        // 1. Setup Test Company
        let company = await Company.findOne({ name: 'Test Payment Co' });
        if (!company) {
            company = await Company.create({
                name: 'Test Payment Co',
                displayName: 'Test Bike Co',
                nit: '999999999-9',
                automaticInvoicing: true,
                automaticCutOff: false,
                contractDefaults: {
                    dailyRate: 30000,
                    contractDays: 100,
                    freeDaysLimit: 4,
                    freeDayPolicy: 'FIXED_WEEKDAY',
                    fixedFreeDayOfWeek: 0,
                    paymentFrequency: 1
                }
            });
            console.log('✅ Test Company created.');
        }

        // 2. Setup Test Device
        let device = await Device.findOne({ name: testDeviceName });
        if (!device) {
            device = await Device.create({
                deviceId: 999999,
                name: testDeviceName,
                companyId: company._id,
                companyName: company.name,
                hasActiveContract: true,
                gpsId: 'GPS999',
                megaDeviceId: 'MEGA999'
            });
            console.log('✅ Test Device created.');
        } else {
            device.hasActiveContract = true;
            await device.save();
        }

        // ==========================================
        // TEST CASE 1: FIXED_WEEKDAY (SUNDAY FREE)
        // ==========================================
        console.log('\n--- TEST CASE 1: FIXED_WEEKDAY (SUNDAYS FREE) ---');
        await Contract.deleteMany({ deviceIdName: testDeviceName });
        await Invoice.deleteMany({ deviceIdName: testDeviceName });
        await Payment.deleteMany({ deviceIdName: testDeviceName });

        const startDate1 = dayjs().startOf('week').add(1, 'day'); // Current/Next Monday
        const contract1 = await contractRepository.createContract({
            startDate: startDate1.format('YYYY-MM-DD'),
            contractDays: 30,
            dailyRate: 30000,
            freeDaysLimit: 4,
            freeDayPolicy: 'FIXED_WEEKDAY',
            fixedFreeDayOfWeek: 0, // Sunday
            paymentFrequency: 12, // 12 paid days cycle
            devicePin: '1234'
        }, device);

        const mult1 = Contract.getBillingMultiplier(contract1.paymentFrequency, contract1.freeDayPolicy);
        const amount1 = contract1.dailyRate * mult1;
        console.log(`ℹ️ paymentFrequency: ${contract1.paymentFrequency}, Policy: ${contract1.freeDayPolicy}`);
        console.log(`ℹ️ Multiplier: ${mult1} (Expected: 12) | Amount: ${amount1} COP (Expected: 360000)`);

        const paymentData1 = {
            _id: `PAY-TEST1-${Date.now()}`,
            paymentId: `PAY-TEST1-${Date.now()}`,
            reference: `REF-TEST1-${Date.now()}`,
            amount_in_cents: amount1 * 100,
            amount: amount1,
            currency: 'COP',
            payment_method_type: 'WOMPI',
            type: 'WOMPI',
            deviceIdName: testDeviceName,
            deviceId: String(device.deviceId),
            gpsId: device.gpsId,
            companyId: company._id,
            finalized_at: new Date(),
            created_at: new Date(),
            used: false
        };

        const payment1 = await paymentRepository.upsertPayment(paymentData1);
        await invoiceRepository.processInvoicePaymentAtomically(payment1);

        const invoices1 = await Invoice.find({ deviceIdName: testDeviceName }).sort({ date: 1 });
        let paidCount1 = 0, freeCount1 = 0;
        invoices1.forEach(inv => {
            if (inv.dayType === 'PAID') paidCount1++;
            if (inv.dayType === 'FREE') freeCount1++;
        });

        console.log(`👉 Paid Invoices Count: ${paidCount1} (Expected: 12)`);
        console.log(`👉 Free Invoices Count: ${freeCount1} (Expected: 2)`);
        console.log(`👉 Total Calendar Days: ${invoices1.length} (Expected: 14)`);

        const tc1Success = (paidCount1 === 12 && freeCount1 === 2 && invoices1.length === 14);

        // ==========================================
        // TEST CASE 2: FLEXIBLE POLICY (NO SUNDAY FREE AUTOMATICALLY)
        // ==========================================
        console.log('\n--- TEST CASE 2: FLEXIBLE POLICY (SUNDAYS PAID) ---');
        await Contract.deleteMany({ deviceIdName: testDeviceName });
        await Invoice.deleteMany({ deviceIdName: testDeviceName });
        await Payment.deleteMany({ deviceIdName: testDeviceName });

        const contract2 = await contractRepository.createContract({
            startDate: startDate1.format('YYYY-MM-DD'),
            contractDays: 30,
            dailyRate: 30000,
            freeDaysLimit: 4,
            freeDayPolicy: 'FLEXIBLE', // Flexible
            paymentFrequency: 12, // 12 paid days cycle
            devicePin: '1234'
        }, device);

        const mult2 = Contract.getBillingMultiplier(contract2.paymentFrequency, contract2.freeDayPolicy);
        const amount2 = contract2.dailyRate * mult2;
        console.log(`ℹ️ paymentFrequency: ${contract2.paymentFrequency}, Policy: ${contract2.freeDayPolicy}`);
        console.log(`ℹ️ Multiplier: ${mult2} (Expected: 12) | Amount: ${amount2} COP (Expected: 360000)`);

        const paymentData2 = {
            _id: `PAY-TEST2-${Date.now()}`,
            paymentId: `PAY-TEST2-${Date.now()}`,
            reference: `REF-TEST2-${Date.now()}`,
            amount_in_cents: amount2 * 100,
            amount: amount2,
            currency: 'COP',
            payment_method_type: 'WOMPI',
            type: 'WOMPI',
            deviceIdName: testDeviceName,
            deviceId: String(device.deviceId),
            gpsId: device.gpsId,
            companyId: company._id,
            finalized_at: new Date(),
            created_at: new Date(),
            used: false
        };

        const payment2 = await paymentRepository.upsertPayment(paymentData2);
        await invoiceRepository.processInvoicePaymentAtomically(payment2);

        const invoices2 = await Invoice.find({ deviceIdName: testDeviceName }).sort({ date: 1 });
        let paidCount2 = 0, freeCount2 = 0;
        invoices2.forEach(inv => {
            if (inv.dayType === 'PAID') paidCount2++;
            if (inv.dayType === 'FREE') freeCount2++;
        });

        console.log(`👉 Paid Invoices Count: ${paidCount2} (Expected: 14)`);
        console.log(`👉 Free Invoices Count: ${freeCount2} (Expected: 0)`);
        console.log(`👉 Total Calendar Days: ${invoices2.length} (Expected: 14)`);

        const tc2Success = (paidCount2 === 14 && freeCount2 === 0 && invoices2.length === 14);

        // ==========================================
        // TEST CASE 3: USE FLEXIBLE FREE DAY ON PREPAID PERIOD
        // ==========================================
        console.log('\n--- TEST CASE 3: APPLY FLEXIBLE FREE DAY ON PREPAID PERIOD ---');
        // Let's create an invoice for today to make sure it's prepaid (it is already pre-created in test 2)
        // Let's verify today's date format
        const todayDateStr = dayjs().startOf('day').format('YYYY-MM-DD');
        console.log(`ℹ️ Simulating flexible free day requested for today: ${todayDateStr}`);

        // Mock GPS adapter status check for applyFreeDay physical activation trigger
        const mockGpsAdapter = {
            getDetailedStatus: async () => ({ engineOn: true, cutOff: 0 }),
            executeAndVerify: async () => true
        };
        const originalGetGpsAdapter = companyService.getGpsAdapter;
        companyService.getGpsAdapter = async (_companyId) => mockGpsAdapter;

        // Apply a free day
        const freeDayResult = await paymentService.applyFreeDay(testDeviceName, contract2.contractId, company._id);
        console.log('ℹ️ applyFreeDay Result:', JSON.stringify(freeDayResult));

        // Restore original GPS adapter
        companyService.getGpsAdapter = originalGetGpsAdapter;

        const invoices3 = await Invoice.find({ deviceIdName: testDeviceName }).sort({ date: 1 });
        let paidCount3 = 0, freeCount3 = 0;
        invoices3.forEach((inv, idx) => {
            const dateStr = dayjs(inv.date).format('YYYY-MM-DD');
            console.log(`   [${idx+1}] ${dateStr} (${dayjs(inv.date).format('dddd')}) | Type: ${inv.dayType} | Amount: ${inv.amount}`);
            if (inv.dayType === 'PAID') paidCount3++;
            if (inv.dayType === 'FREE') freeCount3++;
        });

        console.log(`👉 Paid Invoices Count: ${paidCount3} (Expected: 14 - today converted to FREE, 1 new PAID added at end)`);
        console.log(`👉 Free Invoices Count: ${freeCount3} (Expected: 1 - today converted to FREE)`);
        console.log(`👉 Total Calendar Days: ${invoices3.length} (Expected: 15)`);

        const todayInvoice = await Invoice.findOne({ deviceIdName: testDeviceName, date: dayjs().startOf('day').toDate() });
        const todayIsFree = todayInvoice && todayInvoice.dayType === 'FREE';
        console.log(`👉 Today's Invoice is FREE: ${todayIsFree} (Expected: true)`);

        const tc3Success = (paidCount3 === 14 && freeCount3 === 1 && invoices3.length === 15 && todayIsFree);

        // ==========================================
        // FINAL RESULTS
        // ==========================================
        console.log('\n--- SUMMARY ---');
        console.log(`Test Case 1 (Fixed Sundays): ${tc1Success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Test Case 2 (Flexible Period): ${tc2Success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Test Case 3 (Flexible Free Day Extension): ${tc3Success ? '✅ PASSED' : '❌ FAILED'}`);

        if (tc1Success && tc2Success && tc3Success) {
            console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! logic is extremely robust!');
        } else {
            console.error('\n❌ SOME TESTS FAILED.');
        }

        // Clean up
        await Contract.deleteMany({ deviceIdName: testDeviceName });
        await Invoice.deleteMany({ deviceIdName: testDeviceName });
        await Payment.deleteMany({ deviceIdName: testDeviceName });
        console.log('🧹 Cleaned up test data.');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        await disconnectDatabase();
        console.log('🔌 Disconnected from DB.');
    }
}

runTest();
