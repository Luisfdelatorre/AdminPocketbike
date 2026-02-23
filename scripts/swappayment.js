import mongoose from "mongoose";
import { MongoDB } from "../server/config/components/core.js";

async function run() {
    // ==== CONFIG ====
    const dbName = "payments-wompi";

    const plate = "XZQ69H";
    const oldInvoiceId22 = "XZQ69H-2026-02-22";     // Sunday -> FREE
    const newInvoiceId27 = "XZQ69H-2026-02-27";     // New day to charge instead (choose the correct date)
    const dailyAmount = 35000;

    // Optional: customize IDs for inserted docs
    const freePaymentId = `FREE-${oldInvoiceId22}-EF`;
    // =================2

    await mongoose.connect(MongoDB.URI, { dbName });
    console.log("✅ Connected to:", mongoose.connection.db.databaseName);

    const db = mongoose.connection.db;

    try {
        const invoices = db.collection("invoices");
        const payments = db.collection("payments");

        // 1) Load the old invoice (Feb 22)
        const oldInv = await invoices.findOne({ _id: oldInvoiceId22 });

        if (!oldInv) {
            throw new Error(`Old invoice not found: ${oldInvoiceId22}`);
        }

        // 2) Load the new invoice (Feb 27) which should already exist
        const newInv = await invoices.findOne({ _id: newInvoiceId27 });

        if (!newInv) {
            throw new Error(`New invoice not found: ${newInvoiceId27}. Please generate it first.`);
        }

        // 3) Update the new invoice (Feb 27) to be PAID, using the old invoice's transaction details
        await invoices.updateOne(
            { _id: newInvoiceId27 },
            {
                $set: {
                    paid: true,
                    paidAmount: oldInv.paidAmount || dailyAmount,
                    dayType: "PAID",
                    transaction: oldInv.transaction, // Copy transaction id and reference
                    updatedAt: new Date()
                }
            }
        );
        console.log(`🧾 Updated existing invoice ${newInvoiceId27} to PAID.`);

        // 4) Move payment from old invoice -> new invoice in the Payments collection
        const moveRes = await payments.updateOne(
            { invoiceId: oldInvoiceId22 },
            {
                $set: {
                    invoiceId: newInvoiceId27,
                    unpaidInvoiceId: newInvoiceId27,
                    updatedAt: new Date()
                }
            }
        );

        if (moveRes.modifiedCount > 0) {
            console.log(`💰 Payment successfully moved to ${newInvoiceId27}`);
        } else {
            console.log(`⚠️ No payment document found attached to ${oldInvoiceId22}`);
        }

        // 5) Mark old invoice (Feb 22) as FREE
        await invoices.updateOne(
            { _id: oldInvoiceId22 },
            {
                $set: {
                    amount: 0,
                    paidAmount: 0,
                    paid: true,
                    dayType: "FREE",
                    transaction: {
                        id: freePaymentId,
                        reference: freePaymentId,
                        type: "FREE",
                        finalized_at: new Date()
                    },
                    updatedAt: new Date()
                }
            }
        );
        console.log("✅ Marked invoice FREE:", oldInvoiceId22);

        const freePaymentDoc = {
            _id: freePaymentId,
            paymentId: freePaymentId,
            invoiceId: oldInvoiceId22,
            unpaidInvoiceId: oldInvoiceId22,
            invoiceDate: oldInv.invoiceDate,
            amount: 0,
            amount_in_cents: 0,
            currency: "COP",
            status: "APPROVED",
            deviceIdName: oldInv.deviceIdName ?? plate,
            deviceId: oldInv.deviceId,
            companyId: oldInv.companyId,
            megaDeviceId: oldInv.megaDeviceId,
            reference: freePaymentId,
            payment_method_type: "FREE",
            type: "FREE",
            used: true,
            finalized_at: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await payments.insertOne(freePaymentDoc);
        console.log("🧾 Created FREE payment:", freePaymentId);

        console.log("🎯 Done. Updates committed.");
    } catch (err) {
        console.error("❌ Failed:", err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();