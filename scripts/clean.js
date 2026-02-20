import mongoose from "mongoose";
import { MongoDB } from "../server/config/components/core.js";

const cleanDatabase = async () => {
    try {
        console.log("🔌 Connecting...");

        await mongoose.connect(MongoDB.URI, {
            dbName: "payments-wompi" // 👈 FORZAMOS la BD correcta
        });

        console.log("✅ Connected to:", mongoose.connection.db.databaseName);

        const collectionsToClean = [
            "payments",
            "invoices",
            "contracts",
            //"nequiTransactions",
            // "wompiTransactions",
            // "transactionverifications"
        ];

        const existingCollections = (
            await mongoose.connection.db.listCollections().toArray()
        ).map(c => c.name);

        for (const name of collectionsToClean) {
            if (existingCollections.includes(name)) {
                console.log(`🧹 Cleaning ${name}...`);
                await mongoose.connection.collection(name).deleteMany({});
                console.log(`✅ ${name} cleaned.`);
            } else {
                console.log(`⚠️ ${name} does not exist.`);
            }
        }

        console.log("🎯 Database cleaned successfully.");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected.");
        process.exit(0);
    }
};

cleanDatabase();