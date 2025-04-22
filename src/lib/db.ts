import mongoose from "mongoose";

let isConnected = false;
const MONGODB_URL = process.env.MONGO_URI || "";

export default async function connectDB() {
    if (isConnected) return;

    if (!MONGODB_URL) {
        throw new Error("Please define the MONGO_URI environment variable inside .env.local");
    }

    try {
        const db = await mongoose.connect(MONGODB_URL);

        isConnected = db.connections[0].readyState === 1;
        console.log('MongoDB Connected');
    } catch (error) {
        console.error("Database connection error:", error);
        throw new Error("Failed to connect to MongoDB");
    }
}
