import mongoose from 'mongoose';
import { config } from './config.js';
import { MarkSheet } from './models/MarkSheet.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
  // MarkSheet gained a `strand` field: drop its old unique index and build the new one (a no-op once done).
  try { await MarkSheet.syncIndexes(); } catch (e) { console.error('Could not sync MarkSheet indexes:', e.message); }
}
