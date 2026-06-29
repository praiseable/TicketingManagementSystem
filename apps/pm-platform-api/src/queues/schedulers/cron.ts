import dayjs from 'dayjs';
import { PeriodType } from '@pm-platform/db';
import { performanceQueue } from '../index.js';

export async function registerCronJobs() {
  await performanceQueue.upsertJobScheduler('nightly-performance-daily', { pattern: '0 0 * * *' }, { name: 'aggregate-daily', data: { periodType: PeriodType.DAILY, periodKey: dayjs().subtract(1, 'day').format('YYYY-MM-DD') } });
  await performanceQueue.upsertJobScheduler('nightly-performance-monthly', { pattern: '5 0 * * *' }, { name: 'aggregate-monthly', data: { periodType: PeriodType.MONTHLY, periodKey: dayjs().format('YYYY-MM') } });
}
