import { Queue } from 'bullmq';
import { createRedisConnection } from '@pm-platform/db';

export const connection = createRedisConnection();
const queueConnection = connection as any;

export const emailQueue = new Queue('email-queue', { connection: queueConnection });
export const webhookQueue = new Queue('webhook-queue', { connection: queueConnection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } });
export const searchSyncQueue = new Queue('search-sync-queue', { connection: queueConnection });
export const performanceQueue = new Queue('performance-queue', { connection: queueConnection });

export async function closeQueues() {
  await Promise.all([emailQueue.close(), webhookQueue.close(), searchSyncQueue.close(), performanceQueue.close(), connection.quit()]);
}
