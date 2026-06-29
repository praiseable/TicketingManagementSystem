import { Worker } from 'bullmq';
import { connection } from '../index.js';
import { emailService } from '../../services/email.service.js';

export const emailWorker = new Worker(
  'email-queue',
  async (job) => {
    await emailService.sendNotification(job.data.userId, job.data.title, job.data.body);
  },
  { connection, concurrency: 5 }
);
