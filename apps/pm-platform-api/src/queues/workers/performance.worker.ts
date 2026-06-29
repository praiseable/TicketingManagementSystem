import { Worker } from 'bullmq';
import dayjs from 'dayjs';
import { PeriodType } from '@pm-platform/db';
import { connection } from '../index.js';
import { performanceService } from '../../services/performance.service.js';

export const performanceWorker = new Worker(
  'performance-queue',
  async (job) => {
    const periodKey = job.data.periodKey ?? dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    await performanceService.aggregateAllUsers(job.data.periodType ?? PeriodType.DAILY, periodKey);
  },
  { connection, concurrency: 2 }
);
