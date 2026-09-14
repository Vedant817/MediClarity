import mongoose from "mongoose";

const MONGODB_URL = process.env.MONGO_URI || "";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseCache;
};

function getCache(): MongooseCache {
  if (!globalWithMongoose.__mongooseCache) {
    globalWithMongoose.__mongooseCache = { conn: null, promise: null };
  }
  return globalWithMongoose.__mongooseCache;
}

/**
 * Shared, cached MongoDB connection (canonical Mongoose + Next.js pattern).
 * - Reuses one connection (and one connect promise) across hot reloads,
 *   route bundles, and concurrent requests instead of handshaking per call.
 * - Reconnects if the underlying connection drops instead of trusting a
 *   stale boolean flag.
 */
export default async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URL) {
    throw new Error("Please define the MONGO_URI environment variable inside .env.local");
  }

  const cache = getCache();

  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URL).then((connected) => {
      cache.conn = connected;
      console.log("MongoDB Connected");
      return connected;
    }).catch((error) => {
      cache.promise = null;
      cache.conn = null;
      console.error("Database connection error:", error);
      throw new Error("Failed to connect to MongoDB");
    });
  }

  return cache.promise;
}
