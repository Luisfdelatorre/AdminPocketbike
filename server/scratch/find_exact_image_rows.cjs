const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27018/payments-wompi-pocketbike?authSource=admin', { directConnection: true });
        
        const plates = ['QBK45I', 'QBK44I', 'QBD27I', 'MWW08I', 'QBD26I', 'QBD25I'];
        
        // Search payments collection
        const payments = await mongoose.connection.db.collection('payments')
            .find({
                $or: [
                    { deviceIdName: { $in: plates } },
                    { reference: { $regex: plates.join('|') } },
                    { invoiceId: { $regex: plates.join('|') } }
                ]
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
            
        console.log('=== PAYMENTS MATCHING PLATES ===');
        payments.forEach(p => {
            console.log(p.deviceIdName, p.amount, p.status, p.createdAt, p._id, p.reference, p.invoiceId);
        });

        // Search invoices collection
        const invoices = await mongoose.connection.db.collection('invoices')
            .find({
                deviceIdName: { $in: plates },
                date: { $gte: new Date('2026-11-14T00:00:00Z'), $lte: new Date('2026-11-16T23:59:59Z') }
            })
            .toArray();
            
        console.log('=== INVOICES MATCHING PLATES ===');
        invoices.forEach(inv => {
            console.log(inv.deviceIdName, inv.date, inv.amount, inv.paidAmount, inv.dayType, inv.status, inv.transaction);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

