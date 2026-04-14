import { config } from 'dotenv';
config({ path: '../../.env' });

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createDb } from '@latex-ide/db';
import { handleCompileJob, type CompileJobData } from './compile-job.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const { db, pool } = createDb(DATABASE_URL);

const worker = new Worker<CompileJobData>(
  'compile',
  async (job) => {
    console.log(`[compile] Processing job ${job.id} for project ${job.data.projectId}`);
    const result = await handleCompileJob(job.data, job.id!, db);
    console.log(
      `[compile] Job ${job.id} ${result.success ? 'succeeded' : 'failed'}: ${result.errors.length} errors, ${result.warnings.length} warnings`,
    );
    return result;
  },
  {
    connection,
    concurrency: 4,
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 3600, count: 100 },
  },
);

worker.on('error', (err) => {
  console.error('[compile] Worker error:', err);
});

console.log(`[compile] Worker started, listening on queue "compile"`);

function shutdown() {
  console.log('[compile] Shutting down...');
  worker
    .close()
    .then(() => connection.quit())
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[compile] Shutdown error:', err);
      process.exit(1);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
