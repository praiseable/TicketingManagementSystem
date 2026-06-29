import { randomUUID } from 'node:crypto';
import { Client } from 'minio';
import { env } from '../config/env.js';

const [endPoint, portRaw] = env.MINIO_ENDPOINT.split(':');
export const minio = new Client({ endPoint, port: Number(portRaw ?? 9000), useSSL: false, accessKey: env.MINIO_ACCESS_KEY, secretKey: env.MINIO_SECRET_KEY });

async function ensureBucket(bucket: string) {
  const exists = await minio.bucketExists(bucket).catch(() => false);
  if (!exists) await minio.makeBucket(bucket);
}

export const storageService = {
  async putAttachment(file: Express.Multer.File) {
    const bucket = env.MINIO_BUCKET_ATTACH;
    await ensureBucket(bucket);
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${cleanName}`;
    await minio.putObject(bucket, key, file.buffer, file.size, { 'Content-Type': file.mimetype });
    return { bucket, key };
  },
  async presignedAttachmentUrl(key: string) {
    await ensureBucket(env.MINIO_BUCKET_ATTACH);
    return minio.presignedGetObject(env.MINIO_BUCKET_ATTACH, key, 3600);
  },
  async removeAttachment(key: string) {
    await ensureBucket(env.MINIO_BUCKET_ATTACH);
    await minio.removeObject(env.MINIO_BUCKET_ATTACH, key).catch(() => undefined);
  }
};
