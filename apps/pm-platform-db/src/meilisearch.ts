import { MeiliSearch } from 'meilisearch';

export const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_URL ?? 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_KEY ?? 'your-master-key'
});

const indexes = [
  { uid: 'issues', primaryKey: 'id', searchableAttributes: ['key', 'title', 'description', 'comments'], filterableAttributes: ['projectId', 'status', 'assigneeId', 'priority', 'labels', 'sprintId'] },
  { uid: 'pages', primaryKey: 'id', searchableAttributes: ['title', 'content'], filterableAttributes: ['spaceId', 'createdById'] },
  { uid: 'projects', primaryKey: 'id', searchableAttributes: ['name', 'key', 'description'], filterableAttributes: ['orgId'] }
];

export async function bootstrapMeilisearch() {
  for (const index of indexes) {
    await meili.createIndex(index.uid, { primaryKey: index.primaryKey }).catch(() => undefined);
    const target = meili.index(index.uid);
    await target.updateSearchableAttributes(index.searchableAttributes);
    await target.updateFilterableAttributes(index.filterableAttributes);
  }
}

export default meili;
