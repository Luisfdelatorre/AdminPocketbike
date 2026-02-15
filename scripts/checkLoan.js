import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import { Invoice } from '../server/models/Invoice.js';
import { Payment } from '../server/models/Payment.js';

async function checkLoan() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDatabase();

        const deviceIdName = 'XZQ78H';

        // Find latest LOAN payment for device
        const payment = await Payment.findOne({
            deviceIdName,
            type: 'LOAN'
        }).sort({ created_at: -1 });

        if (payment) {
            console.log('✅ Found Loan Payment:', payment._id);
            console.log('   Created At:', payment.created_at);
            console.log('   Invoice ID:', payment.invoiceId);

            // Check Invoice
            const invoice = await Invoice.findById(payment.invoiceId);
            if (invoice) {
                console.log('✅ Found Linked Invoice:', invoice._id);
                console.log('   DayType:', invoice.dayType);
                console.log('   ProvisionalPass:', invoice.provisionalPass);

                if (invoice.dayType === 'LOAN' && invoice.provisionalPass === true) {
                    console.log('✅ Invoice status is CORRECT (LOAN + Provisional)');
                } else {
                    console.log('⚠️ Invoice status MISMATCH');
                }
            } else {
                console.log('❌ Linked Invoice NOT found');
            }

        } else {
            console.log('❌ No Loan Payment found for device');
        }

    } catch (error) {
        console.error('❌ Error checking loan:', error);
    } finally {
        await disconnectDatabase();
        process.exit();
    }
}

checkLoan();
