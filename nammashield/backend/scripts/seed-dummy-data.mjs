import mongoose from 'mongoose';
import 'dotenv/config';
import { Report } from '../dist/models/Report.js';
import { Alert } from '../dist/models/Alert.js';
import crypto from 'crypto';

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DATABASE || 'thoondilguard',
  });
  console.log('Connected to MongoDB');

  // Insert Dummy Reports
  const reportsToInsert = [
    {
      referenceId: crypto.randomBytes(12).toString('hex'),
      inputType: 'text',
      source: 'web',
      category: 'bank_impersonation',
      status: 'NEW',
      content: 'Dear customer, your HDFC bank account is blocked. Please update KYC by clicking this link: http://hdfc-kyc-update.com',
      riskLevel: 'HIGH_CONCERN',
      reportedAt: new Date(),
    },
    {
      referenceId: crypto.randomBytes(12).toString('hex'),
      inputType: 'text',
      source: 'web',
      category: 'job_scam',
      status: 'UNDER_REVIEW',
      content: 'You have been selected for a part-time job from home earning Rs 5000/day. Reply YES on Whatsapp to register.',
      riskLevel: 'NEEDS_VERIFICATION',
      reportedAt: new Date(Date.now() - 86400000), // 1 day ago
    }
  ];

  for (const r of reportsToInsert) {
    await Report.create(r);
  }
  console.log(`Inserted ${reportsToInsert.length} dummy reports`);

  // Insert Dummy Published Alert
  const alertId = crypto.randomBytes(8).toString('hex');
  await Alert.create({
    alertId,
    title: 'Widespread HDFC KYC Scam Messages',
    description: 'Scammers are sending fake SMS messages claiming to be from HDFC Bank and asking you to update your KYC via a malicious link. Do not click on these links. HDFC will never ask for your password or OTP.',
    category: 'bank_impersonation',
    status: 'PUBLISHED',
    publishedAt: new Date(),
  });
  console.log(`Inserted dummy published alert`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(console.error);
