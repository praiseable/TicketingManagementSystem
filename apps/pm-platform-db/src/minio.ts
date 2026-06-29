import { Client } from 'minio';

const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
const port = Number(process.env.MINIO_PORT ?? 9000);
const useSSL = process.env.MINIO_USE_SSL === 'true';

export const minio = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin'
});

export async function bootstrapBuckets() {
  const buckets = [
    process.env.MINIO_BUCKET_ATTACHMENTS ?? 'attachments',
    process.env.MINIO_BUCKET_EXPORTS ?? 'exports'
  ];

  for (const bucket of buckets) {
    const exists = await minio.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await minio.makeBucket(bucket);
    }
  }
}

export default minio;
