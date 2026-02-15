import mongoose from 'mongoose';

const URI = 'mongodb://127.0.0.1:27017/payments-wompi';

// Minimal schema definition to avoid import issues
const paymentSchema = new mongoose.Schema({
    invoiceId: String,
    amount: Number,
    status: String,
    createdAt: Date
}, { strict: false });

const Payment = mongoose.model('Payment', paymentSchema);

async function debugPayments() {
    try {
        console.log("Connecting to:", URI);
        await mongoose.connect(URI);
        console.log("Connected.");

        const count = await Payment.countDocuments();
        console.log(`Total payments in DB: ${count}`);

        const payments = await Payment.find().sort({ createdAt: -1 }).limit(3);

        console.log(`\nLast ${payments.length} (concise):`);
        payments.forEach(p => {
            console.log(`ID: "${p.invoiceId}" | Date: ${p.createdAt.toISOString()}`);
        });

        // specific check for Feb 2026
        const start = new Date('2026-02-01');
        const end = new Date('2026-02-28'); // roughly
        const febPayments = await Payment.countDocuments({
            createdAt: { $gte: start, $lte: end }
        });
        console.log(`\nPayments in Feb 2026 (by createdAt): ${febPayments}`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

debugPayments();
