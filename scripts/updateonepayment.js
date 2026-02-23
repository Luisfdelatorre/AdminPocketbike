import mongoose from "mongoose";
import { MongoDB } from "../server/config/components/core.js";

const updateAmounts = async () => {
    try {
        await mongoose.connect(MongoDB.URI, { dbName: "payments-wompi" });

        console.log("✅ Connected to:", mongoose.connection.db.databaseName);

        // 1️⃣ Update invoice
        const invoiceUpdate = await mongoose.connection
            .collection("invoices")
            .updateOne(
                { _id: "XZQ63H-2026-02-19" },   // or { invoiceId: "..."} if that’s your field
                { $set: { amount: 280000, paidAmount: 280000 } }
            );

        console.log("🧾 Invoice updated:", invoiceUpdate.modifiedCount);

        // 2️⃣ Update payment
        const paymentUpdate = await mongoose.connection
            .collection("payments")
            .updateOne(
                { _id: "IF-XZQ63H-2026-02-20" },  // or { paymentId: "..."} if different
                { $set: { amount: 280000 } }
            );

        console.log("💰 Payment updated:", paymentUpdate.modifiedCount);

        console.log("🎯 Update completed.");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

updateAmounts();