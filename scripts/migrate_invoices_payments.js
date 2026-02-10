import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Device, Invoice, Payment } from '../server/models/index.js';
import { Company, Contract } from '../server/models/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrateInvoicesAndPayments = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Migrate Invoices
        console.log('--- Migrating Invoices ---');
        const invoices = await Invoice.find({ companyId: { $exists: false } });
        console.log(`Found ${invoices.length} invoices without companyId.`);

        let invoiceUpdatedCount = 0;
        let invoiceErrorCount = 0;
        let invoiceSkippedCount = 0;

        const deviceCache = new Map();

        // Find default company once
        const defaultCompany = await Company.findOne({ name: 'FOR EVERYONE' });
        console.log(`Default company 'FOR EVERYONE': ${defaultCompany ? 'Found' : 'Not Found'} (${defaultCompany?._id})`);

        for (const invoice of invoices) {
            try {
                const deviceName = invoice.deviceIdName;
                let device = deviceCache.get(deviceName);
                let companyId = null;
                let companyName = null;

                if (!device) {
                    device = await Device.findOne({ name: deviceName }).select('companyId companyName');
                    if (device) {
                        deviceCache.set(deviceName, device);
                    }
                }

                const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

                // Strategy 1: Device
                if (device && device.companyId && isValidObjectId(device.companyId)) {
                    companyId = new mongoose.Types.ObjectId(device.companyId);
                    companyName = device.companyName;
                }

                // Strategy 2: Contract
                if (!companyId) {
                    const contract = await Contract.findOne({ deviceIdName: deviceName }).select('companyId companyName').sort({ createdAt: -1 });
                    if (contract) {
                        if (contract.companyId && isValidObjectId(contract.companyId)) {
                            companyId = contract.companyId;
                            companyName = contract.companyName;
                        } else {
                            // console.warn(`[WARN] Contract found for '${deviceName}' but has invalid companyId: ${contract.companyId}`);
                        }
                    }
                }

                // Strategy 3: Default Company (Fallback for legacy '8' or missing)
                if (!companyId) {
                    if (defaultCompany) {
                        // Only use default if device exists (don't migrate random junk) OR force it?
                        // Let's force it for now to clean up data
                        companyId = defaultCompany._id;
                        companyName = defaultCompany.name;
                    }
                }

                if (companyId) {
                    invoice.companyId = companyId;
                    invoice.companyName = companyName;
                    await invoice.save();
                    process.stdout.write('.');
                    invoiceUpdatedCount++;
                } else {
                    console.warn(`[SKIP] Invoice ${invoice._id}: No companyId found via Device, Contract, or Default for '${deviceName}'`);
                    invoiceSkippedCount++;
                }
            } catch (error) {
                console.error(`\nError updating invoice ${invoice._id}:`, error.message);
                invoiceErrorCount++;
            }
        }
        console.log(`\nInvoices: Updated ${invoiceUpdatedCount}, Skipped ${invoiceSkippedCount}, Errors ${invoiceErrorCount}`);

        // 2. Migrate Payments
        console.log('\n--- Migrating Payments ---');
        const payments = await Payment.find({ companyId: { $exists: false } });
        console.log(`Found ${payments.length} payments without companyId.`);

        let paymentUpdatedCount = 0;
        let paymentErrorCount = 0;
        let paymentSkippedCount = 0;

        for (const payment of payments) {
            try {
                const invoice = await Invoice.findOne({
                    $or: [
                        { _id: payment.invoiceId },
                        { invoiceId: payment.invoiceId }
                    ]
                }).select('companyId companyName deviceIdName');

                let companyId = invoice?.companyId;
                let companyName = invoice?.companyName;

                if (!companyId && defaultCompany) {
                    companyId = defaultCompany._id;
                    companyName = defaultCompany.name;
                }

                if (companyId) {
                    payment.companyId = companyId;
                    payment.companyName = companyName;
                    await payment.save();
                    process.stdout.write('.');
                    paymentUpdatedCount++;
                } else {
                    paymentSkippedCount++;
                }

            } catch (error) {
                console.error(`\nError updating payment ${payment._id}:`, error.message);
                paymentErrorCount++;
            }
        }

        console.log(`\nPayments: Updated ${paymentUpdatedCount}, Skipped ${paymentSkippedCount}, Errors ${paymentErrorCount}`);
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateInvoicesAndPayments();
