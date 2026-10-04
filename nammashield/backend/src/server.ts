import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { connectToDatabase, disconnectFromDatabase } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRouter } from './routes/index.js';
import { RateLimitCounter } from './models/RateLimitCounter.js';
import { assertProductionSecurity } from './services/adminSecurity.js';

const app = express();
app.set('trust proxy', env.trustedProxies);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: [...new Set([...env.clientOrigins, ...env.adminOrigins])], credentials: true, exposedHeaders: ['Retry-After'] }));
app.use(express.json({ limit: '128kb' }));
app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    assertProductionSecurity();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Production security configuration is incomplete.');
    process.exitCode = 1;
    return;
  }
  try {
    await connectToDatabase();
    await RateLimitCounter.init();
  } catch (error) {
    if (error instanceof Error && error.message === 'MONGODB_URI is required') {
      console.error('MongoDB connection failed: MONGODB_URI is required');
    } else {
      console.error('MongoDB connection failed: unable to establish a database connection', error);
    }
    process.exitCode = 1;
    return;
  }

  const server = app.listen(env.port, () => {
    console.log(`ThoondilGuard API running on port ${env.port}`);
  });

  let isShuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received; shutting down gracefully`);

    server.close((error) => {
      if (error) {
        console.error('HTTP server shutdown failed');
        process.exitCode = 1;
      }

      void disconnectFromDatabase()
        .then(() => {
          if (!error) console.log('MongoDB connection closed');
        })
        .catch(() => {
          console.error('MongoDB shutdown failed');
          process.exitCode = 1;
        });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void startServer();
