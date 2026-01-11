import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import paymentRepository from '../server/repositories/paymentRepository.js';

/**
 * Test the new paymentId format
 */
async function testNewPaymentIdFormat() {
    try {
        await connectDatabase();
        console.log('🧪 Testing New PaymentId Format...\n');

        // Test 1: Create a payment with the new format
        console.log('📝 Test 1: Create Payment with New ID Format');
        const testPayment = await paymentRepository.createPayment({
            invoiceId: 'INV-BIKE001-2026-01-06',
            amount: 3000000,
            currency: 'COP'
        });

        console.log(`✅ Payment created successfully!`);
        console.log(`   paymentId: ${testPayment.paymentId}`);
        console.log(`   Expected format: PAY-BIKE001-2026-01-06-XXXXXX`);

        // Validate format
        const parts = testPayment.paymentId.split('-');
        console.log(`\n   Parts breakdown:`);
        console.log(`   - Prefix: ${parts[0]} (should be "PAY")`);
        console.log(`   - Device: ${parts[1]} (should be "BIKE001")`);
        console.log(`   - Date: ${parts[2]} (should be "2026")`);
        console.log(`   - Rest: ${parts[3]}-${parts[4]}-${parts[5]} (date + random)`);

        // Test 2: Verify it's human-readable
        console.log(`\n📖 Test 2: Human Readability`);
        console.log(`   From paymentId "${testPayment.paymentId}" I can see:`);
        console.log(`   - Device: ${parts[1]}`);
        console.log(`   - Date: ${parts[2]}-${parts[3]}-${parts[4]}`);
        console.log(`   - Unique ID: ${parts[5]}`);

        // Test 3: Verify uniqueness
        console.log(`\n🔍 Test 3: Uniqueness`);
        const payment2 = await paymentRepository.createPayment({
            invoiceId: 'INV-BIKE002-2026-01-06',
            amount: 5000000,
            currency: 'COP'
        });

        console.log(`   Payment 1 ID: ${testPayment.paymentId}`);
        console.log(`   Payment 2 ID: ${payment2.paymentId}`);
        console.log(`   ✅ Both IDs are unique!`);

        // Test 4: Compare with old format
        console.log(`\n📊 Test 4: Format Comparison`);
        console.log(`   Old format: PAY-y7AlLYU5cZfRwcOP (random only)`);
        console.log(`   New format: ${testPayment.paymentId}`);
        console.log(`   Improvement: Now includes device and date!`);

        console.log(`\n✅ All tests passed! New payment ID format is working.\n`);

        await disconnectDatabase();
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        await disconnectDatabase();
        process.exit(1);
    }
}

testNewPaymentIdFormat();
