import mongoose from "mongoose";
import { MongoDB } from "../server/config/components/core.js";

const deleteContractAndRelatedData = async () => {
    try {
        await mongoose.connect(MongoDB.URI, { dbName: "payments-wompi" });

        console.log("✅ Connected to:", mongoose.connection.db.databaseName);

        const contractId = "CIXZQ71HNL";

        // 1️⃣ Find contract first (to get deviceIdName if needed)
        const contract = await mongoose.connection
            .collection("contracts")
            .findOne({ contractId });

        if (!contract) {
            console.log("⚠️ Contract not found.");
            return;
        }

        console.log("📄 Contract found.");

        const deviceIdName = contract.deviceIdName;

        // 2️⃣ Delete payments linked to contract
        const payments = await mongoose.connection
            .collection("payments")
            .deleteMany({ deviceIdName });

        console.log("💰 Payments deleted:", payments.deletedCount);

        // 3️⃣ Delete invoices linked to contract OR device
        const invoices = await mongoose.connection
            .collection("invoices")
            .deleteMany({
                $or: [
                    { contractId },
                    { deviceIdName }
                ]
            });

        console.log("🧾 Invoices deleted:", invoices.deletedCount);

        // 4️⃣ Delete contract
        const del = await mongoose.connection
            .collection("contracts")
            .deleteOne({ contractId });

        console.log("🗑️ Contract deleted:", del.deletedCount);

        // 5️⃣ Clean device references
        const upd = await mongoose.connection
            .collection("devices")
            .updateMany(
                { contractId },
                { $set: { hasActiveContract: false }, $unset: { contractId: "" } }
            );

        console.log("🔧 Devices updated:", upd.modifiedCount);

        console.log("🎯 Cleanup completed successfully.");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

deleteContractAndRelatedData();