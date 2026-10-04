import mongoose from 'mongoose';
import { setServers } from 'node:dns';
import { env } from './env.js';

if (env.dnsServers.length > 0) {
  setServers(env.dnsServers);
}

let connectionPromise: Promise<typeof mongoose> | undefined;

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('disconnected', () => {
  if (!connectionPromise) console.warn('MongoDB disconnected');
});

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connectionPromise) return connectionPromise;

  const uri = env.mongodbUri?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  connectionPromise = mongoose.connect(uri, { dbName: env.mongodbDatabase }).finally(() => {
    connectionPromise = undefined;
  });

  return connectionPromise;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
