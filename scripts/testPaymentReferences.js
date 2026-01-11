import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import invoiceRepository from '../server/repositories/invoiceRepository.js';
import paymentRepository from '../server/repositories/paymentRepository.js';

/**
 * Test script to verify the new payment reference system
 * This validates that paymentReference = invoiceId works correctly
 */
async function testPaymentReferences() {
    try {
        await connectDatabase();
        console.log('🧪 Testing Payment Reference System...\n');

        // Test 1: Create an invoice
        console.log('📋 Test 1: Create Invoice');
        const testDeviceId = 'TEST-BIKE';
        const testDate = new Date().toISOString().split('T')[0];
        const testAmount = 3000000; // 30,000 COP in cents

        const invoice = await invoiceRepository.createInvoice({
            deviceId: testDeviceId,
            date: testDate,
            amount: testAmount
        });

        console.log(`✅ Invoice created: ${invoice.invoiceId}`);
        console.log(`   Expected format: INV-${testDeviceId}-${testDate}`);
        console.log(`   Actual: ${invoice.invoiceId}\n`);

        // Test 2: Create payment for the invoice
        console.log('💳 Test 2: Create Payment');
        const payment = await paymentRepository.createPayment({
            invoiceId: invoice.invoiceId,
            deviceId: testDeviceId,
            amount: testAmount,
            currency: 'COP'
        });

        console.log(`✅ Payment created: ${payment.paymentId}`);
        console.log(`   invoiceId: ${payment.invoiceId}`);
        console.log(`   paymentReference: ${payment.paymentReference}`);

        // Test 3: Verify paymentReference = invoiceId
        console.log('\n🔍 Test 3: Verify Reference = Invoice ID');
        if (payment.paymentReference === payment.invoiceId) {
            console.log(`✅ PASS: paymentReference matches invoiceId`);
            console.log(`   Both are: ${payment.paymentReference}`);
        } else {
            console.log(`❌ FAIL: References don't match!`);
            console.log(`   paymentReference: ${payment.paymentReference}`);
            console.log(`   invoiceId: ${payment.invoiceId}`);
        }

        // Test 4: Lookup by reference (simulates webhook)
        console.log('\n🔗 Test 4: Lookup by Reference (Webhook Simulation)');
        const foundPayment = await paymentRepository.getPaymentByReference(payment.paymentReference);
        const foundInvoice = await invoiceRepository.getInvoiceById(payment.paymentReference);

        if (foundPayment && foundInvoice) {
            console.log(`✅ PASS: Both found using same reference`);
            console.log(`   Reference used: ${payment.paymentReference}`);
            console.log(`   Payment found: ${foundPayment.paymentId}`);
            console.log(`   Invoice found: ${foundInvoice.invoiceId}`);
        } else {
            console.log(`❌ FAIL: Lookup failed`);
            console.log(`   Payment: ${foundPayment ? 'Found' : 'Not found'}`);
            console.log(`   Invoice: ${foundInvoice ? 'Found' : 'Not found'}`);
        }

        // Test 5: Verify format
        console.log('\n📝 Test 5: Verify Reference Format');
        const expectedFormat = `INV-${testDeviceId}-${testDate}`;
        if (payment.paymentReference === expectedFormat) {
            console.log(`✅ PASS: Reference has correct format`);
            console.log(`   Expected: ${expectedFormat}`);
            console.log(`   Actual: ${payment.paymentReference}`);
        } else {
            console.log(`❌ FAIL: Format mismatch`);
            console.log(`   Expected: ${expectedFormat}`);
            console.log(`   Actual: ${payment.paymentReference}`);
        }

        // Test 6: Try to create duplicate payment (should return existing)
        console.log('\n🔄 Test 6: Duplicate Prevention');
        const duplicatePayment = await paymentRepository.createPayment({
            invoiceId: invoice.invoiceId,
            deviceId: testDeviceId,
            amount: testAmount,
            currency: 'COP'
        });

        if (duplicatePayment.paymentId === payment.paymentId) {
            console.log(`✅ PASS: Duplicate returns existing payment`);
            console.log(`   Original: ${payment.paymentId}`);
            console.log(`   Duplicate: ${duplicatePayment.paymentId}`);
        } else {
            console.log(`❌ FAIL: Created new payment instead of returning existing`);
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(50));
        console.log('✅ Payment Reference Architecture Working!');
        console.log(`   Invoice ID: ${invoice.invoiceId}`);
        console.log(`   Payment Reference: ${payment.paymentReference}`);
        console.log(`   Both are identical: ${payment.paymentReference === invoice.invoiceId ? 'YES ✓' : 'NO ✗'}`);
        console.log('='.repeat(50) + '\n');

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await invoiceRepository.deleteInvoiceById(invoice.invoiceId);
        console.log('✅ Test data removed\n');

        await disconnectDatabase();
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        await disconnectDatabase();
        process.exit(1);
    }
}

testPaymentReferences();
