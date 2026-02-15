import mongoose from 'mongoose';

const URI = 'mongodb://127.0.0.1:27017/payments-wompi';

async function debugPayments() {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(URI);
        console.log("Connected.");

        // Use a generic schema with strict: false to get everything
        const AnySchema = new mongoose.Schema({}, { strict: false });
        const Payment = mongoose.model('Payment', AnySchema, 'payments'); // Explicit collection name

        const payments = await Payment.find().sort({ createdAt: -1 }).limit(5).lean();

        console.log(`Found ${payments.length} payments.`);

        payments.forEach((p, index) => {
            console.log(`\nDOC #${index}: Invoice="${p.invoiceId}" | Status="${p.status}" | Amount=${p.amount}`);
        });

        // Test the Regex Logic
        const month = 2; // Feb
        const year = 2026;
        const paddedMonth = String(month).padStart(2, '0');
        const regex = new RegExp(`-${year}-${paddedMonth}-`);
        console.log(`\nTesting Regex: ${regex}`);

        const matchCount = await Payment.countDocuments({
            invoiceId: { $regex: regex }
        });
        console.log(`Documents matching regex in DB: ${matchCount}`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Done.");
    }
}

debugPayments();
