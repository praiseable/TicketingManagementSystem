import { Worker } from 'bullmq';
import { MeiliSearch } from 'meilisearch';
import { connection } from '../index.js';
import { env } from '../../config/env.js';

const meili = new MeiliSearch({ host: env.MEILISEARCH_URL, apiKey: env.MEILISEARCH_KEY });

export const searchWorker = new Worker(
  'search-sync-queue',
  async (job) => {
    const { index, action, document, id } = job.data;
    if (action === 'delete') await meili.index(index).deleteDocument(id);
    else await meili.index(index).addDocuments([document]);
  },
  { connection, concurrency: 3 }
);
