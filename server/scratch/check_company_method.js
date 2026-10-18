import connectDatabase, { disconnectDatabase } from '../database/connection.js';
import { Company } from '../models/Company.js';
import contractRepository from '../repositories/contractRepository.js';
import paymentService from '../services/paymentService.js';

import { Payment } from '../models/Payment.js';

async function check() {
    try {
        await connectDatabase();
        const contract = await contractRepository.getActiveContractByDevice('IFS83I');
        console.log('Contract companyId:', contract?.companyId);

        const company = await Company.findById(contract?.companyId).lean();
        console.log('Company wompiConfig:', company?.wompiConfig);

        const recentPayments = await Payment.find({ deviceIdName: 'IFS83I' }).sort({ createdAt: -1 }).limit(5).lean();
        console.log('Recent payments for IFS83I:', recentPayments.map(p => ({
            id: p._id,
            reference: p.reference,
            status: p.status,
            paymentMethod: p.paymentMethod,
            hasQrImage: !!p.qrImage,
            createdAt: p.createdAt || p.created_at
        })));

        const status = await paymentService.calculatePaymentStatus(contract);
        console.log('calculatePaymentStatus paymentMethod:', status.paymentMethod);
        console.log('calculatePaymentStatus pendingPayment:', status.pendingPayment);
    } catch (e) {
        console.error(e);
    } finally {
        await disconnectDatabase();
    }
}
check();
