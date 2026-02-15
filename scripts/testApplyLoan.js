import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import paymentService from '../server/services/paymentService.js';
import { Invoice } from '../server/models/Invoice.js';
import { Payment } from '../server/models/Payment.js';

async function testApplyLoan() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDatabase();

        // 1. Find a device with an unpaid invoice (e.g., XZQ78H or any other)
        const deviceIdName = 'XZQ78H'; // Use a known device
        const invoice = await Invoice.findOne({ deviceIdName, paid: false }).sort({ date: 1 });

        if (!invoice) {
            console.log('❌ No unpaid invoice found for testing loan.');
            return;
        }

        console.log(`🔹 Applying loan for device ${deviceIdName}, invoice ${invoice._id}`);

        // 2. Call applyLoan
        const result = await paymentService.applyLoan(deviceIdName, 'contract-id-placeholder', invoice.companyId);
        console.log('🔹 applyLoan result:', result);

        // 3. Verify Payment Created
        const payments = await Payment.find({ invoiceId: invoice._id, type: 'LOAN' });
        if (payments.length > 0) {
            console.log('✅ Loan Payment Created:', payments[0]._id);
        } else {
            console.error('❌ Loan Payment NOT found');
        }

        // 4. Verify Invoice Status
        const updatedInvoice = await Invoice.findById(invoice._id);
        console.log(`🔹 Invoice Status: paid=${updatedInvoice.paid}, dayType=${updatedInvoice.dayType}, provisionalPass=${updatedInvoice.provisionalPass}`);

        if (updatedInvoice.dayType === 'LOAN' && updatedInvoice.provisionalPass === true) {
            console.log('✅ Invoice updated correctly (dayType=LOAN, provisionalPass=true)');
        } else {
            console.error('❌ Invoice NOT updated correctly');
        }

    } catch (error) {
        console.error('❌ Error testing loan:', error);
    } finally {
        await disconnectDatabase();
        process.exit();
    }
}

testApplyLoan();
