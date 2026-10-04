import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { PortalReport, PortalAlert, PortalEvent } from '../src/models/PortalIntegration.js';
import crypto from 'crypto';

async function seed() {
  await connectToDatabase();

  const reportsToInsert = [
    {
      id: crypto.randomBytes(8).toString('hex'),
      text: 'Dear customer, your HDFC bank account is blocked. Please update KYC by clicking this link: http://hdfc-kyc-update.com',
      area: 'Tamil Nadu',
      category: 'bank_impersonation',
      language: 'English',
      status: 'New',
      decision: 'Pending',
      idempotency: crypto.randomBytes(8).toString('hex'),
      submitted: new Date().toISOString(),
      indicators: ['http://hdfc-kyc-update.com'],
    },
    {
      id: crypto.randomBytes(8).toString('hex'),
      text: 'You have been selected for a part-time job from home earning Rs 5000/day. Reply YES on Whatsapp to register.',
      area: 'Chennai',
      category: 'job_scam',
      language: 'English',
      status: 'In progress',
      decision: 'Pending',
      idempotency: crypto.randomBytes(8).toString('hex'),
      submitted: new Date(Date.now() - 86400000).toISOString(),
      indicators: [],
    }
  ];

  for (const r of reportsToInsert) {
    await PortalReport.create(r);
  }
  console.log(`Inserted ${reportsToInsert.length} dummy PortalReports for the Admin Dashboard`);

  await disconnectFromDatabase();
  console.log('Done.');
}

seed().catch(console.error);
