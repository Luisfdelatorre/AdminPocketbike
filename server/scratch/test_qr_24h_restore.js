import connectDatabase, { disconnectDatabase } from '../database/connection.js';
import contractRepository from '../repositories/contractRepository.js';
import paymentService from '../services/paymentService.js';
import { Payment } from '../models/Payment.js';

async function runTest() {
    try {
        await connectDatabase();

        const testRef = `IFS83I-TEST-QR-${Date.now()}`;
        const dummyQrSvg = `PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgdmlld0JveD0iMCAwIDEyMSAxMjEiID48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRkZGRkZGIi8+PC9zdmc+`;

        // Create a pending QR payment created 2 hours ago (within 24 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const payment = new Payment({
            _id: `1511896-TEST-${Date.now()}`,
            paymentId: `PAY-${Date.now()}`,
            invoiceId: `INV-${Date.now()}`,
            reference: testRef,
            amount: 2000,
            status: 'PENDING',
            payment_method_type: 'BANCOLOMBIA_QR',
            paymentMethod: 'BANCOLOMBIA_QR',
            type: 'CYCLE_FEE',
            deviceIdName: 'IFS83I',
            deviceId: '85790574',
            created_at: twoHoursAgo,
            createdAt: twoHoursAgo,
            qrImage: dummyQrSvg
        });

        await payment.save();
        console.log('✅ Test PENDING QR payment created (2 hours old):', payment._id);

        const contract = await contractRepository.getActiveContractByDevice('IFS83I');
        const status = await paymentService.calculatePaymentStatus(contract);

        console.log('📊 Payment status result:');
        console.log(' - paymentMethod:', status.paymentMethod);
        console.log(' - pendingPayment found:', !!status.pendingPayment);
        if (status.pendingPayment) {
            console.log(' - transactionId:', status.pendingPayment.transactionId);
            console.log(' - reference:', status.pendingPayment.reference);
            console.log(' - qrImage present:', !!status.pendingPayment.qrImage);
            console.log(' - createdAt:', status.pendingPayment.createdAt);
        }

        // Clean up test payment
        await Payment.deleteOne({ _id: payment._id });
        console.log('🧹 Cleaned up test payment.');

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        await disconnectDatabase();
    }
}

runTest();
