import { MeiliSearch } from 'meilisearch';
import { env } from '../config/env.js';

const client = new MeiliSearch({ host: env.MEILISEARCH_URL, apiKey: env.MEILISEARCH_KEY });

export const searchService = {
  async global(q: string, filters?: { projectId?: string; type?: string }) {
    const query = q || '';
    const [issues, pages, projects] = await Promise.all([
      client.index('issues').search(query, { limit: 10, filter: filters?.projectId ? [`projectId = ${filters.projectId}`] : undefined }).catch(() => ({ hits: [] })),
      client.index('pages').search(query, { limit: 10 }).catch(() => ({ hits: [] })),
      client.index('projects').search(query, { limit: 10 }).catch(() => ({ hits: [] }))
    ]);
    return { issues: issues.hits, pages: pages.hits, projects: projects.hits };
  },
  async issues(q: string, filters: Record<string, unknown>, page = 1, limit = 25) {
    return client.index('issues').search(q || '', { offset: (page - 1) * limit, limit, filter: Object.entries(filters ?? {}).map(([key, value]) => `${key} = ${JSON.stringify(value)}`) }).catch(() => ({ hits: [], estimatedTotalHits: 0 }));
  }
};
