
import { Device } from '../server/models/Device.js';
import service from '../server/services/deviceServices.js';
import mongoose from 'mongoose';
import { MongoDB } from '../server/config/config.js';

const test = async () => {
    try {
        await mongoose.connect(MongoDB.URI);
        console.log("Connected to DB");

        const conflictingId = "865468052312223"; // From error log

        console.log(`Checking for existing device with uniqueId/name: ${conflictingId}`);
        const existing = await Device.findOne({
            $or: [{ uniqueId: conflictingId }, { name: conflictingId }]
        });

        if (existing) {
            console.log("Found existing conflict:", JSON.stringify(existing, null, 2));
            console.log("Existing _id type:", typeof existing._id);
        } else {
            console.log("No conflicting document found via findOne? Strange.");
        }

        // Just run checking, skip write to avoid error for now
        const stats = await service.bulkWriteDevices(devices);
        console.log("Sync Stats:", stats);

    } catch (error) {
        console.error("Sync Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

test();
