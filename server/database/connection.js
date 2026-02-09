import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

let isConnected = false;

export async function connectDatabase() {
    if (isConnected) {
        console.log('📊 Using existing database connection');
        return;
    }

    try {
        await mongoose.connect(MongoDB.URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
        });

        isConnected = true;
        console.log('✅ MongoDB connected successfully');

        // Handle connection events
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
            isConnected = false;
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            isConnected = false;
        });

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        throw error;
    }
}

export async function disconnectDatabase() {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        console.log('🔌 MongoDB disconnected');
    } catch (error) {
        console.error('❌ Error disconnecting from MongoDB:', error);
        throw error;
    }
}

export default connectDatabase;
