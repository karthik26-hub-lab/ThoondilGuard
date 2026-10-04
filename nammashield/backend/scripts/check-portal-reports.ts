import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { PortalReport } from '../src/models/PortalIntegration.js';

async function check() {
  await connectToDatabase();
  const reports = await PortalReport.find().lean();
  console.log('Reports:', JSON.stringify(reports, null, 2));
  await disconnectFromDatabase();
}

check().catch(console.error);
