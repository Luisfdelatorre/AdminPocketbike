import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { Company } from '../models/Company.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';

async function run() {
    const deviceIdName = process.argv[2];
    const targetCompanyId = process.argv[3];

    if (!deviceIdName || !targetCompanyId) {
        console.error('❌ Error: Missing arguments.');
        console.log('\nUsage:\n  node server/scripts/moveDeviceBillingData.js <deviceIdName/Plate> <targetCompanyId>\n');
        process.exit(1);
    }

    try {
        await connectDatabase();

        // 1. Find the target company
        const company = await Company.findById(targetCompanyId);
        if (!company) {
            console.error(`❌ Error: Company with ID ${targetCompanyId} not found.`);
            await disconnectDatabase();
            process.exit(1);
        }

        console.log(`ℹ️ Moving billing data for device "${deviceIdName}" to company "${company.name}" (${company._id})`);

        // 2. Update Invoices
        console.log('⏳ Updating invoices...');
        const invoiceResult = await Invoice.updateMany(
            { deviceIdName },
            {
                $set: {
                    companyId: company._id,
                    companyName: company.name
                }
            }
        );
        console.log(`✅ Invoices updated: ${invoiceResult.modifiedCount} matched, ${invoiceResult.matchedCount} found.`);

        // 3. Update Payments
        console.log('⏳ Updating payments...');
        const paymentResult = await Payment.updateMany(
            { deviceIdName },
            {
                $set: {
                    companyId: company._id,
                    companyName: company.name
                }
            }
        );
        console.log(`✅ Payments updated: ${paymentResult.modifiedCount} matched, ${paymentResult.matchedCount} found.`);

        console.log('🎉 Transfer completed successfully!');

    } catch (error) {
        console.error('❌ An error occurred during the transfer:', error);
    } finally {
        await disconnectDatabase();
    }
}

run();
