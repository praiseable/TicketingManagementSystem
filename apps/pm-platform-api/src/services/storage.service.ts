import { randomUUID } from 'node:crypto';
import { Client } from 'minio';
import { env } from '../config/env.js';
import { AppError } from '../utils/apiResponse.js';

function minioConfig() {
  const endpointRaw = String(env.MINIO_ENDPOINT || 'localhost:9000').replace(/^https?:\/\//, '');
  const [host, portRaw] = endpointRaw.split(':');
  const explicitPort = Number((env as unknown as { MINIO_PORT?: string | number }).MINIO_PORT ?? 0);
  const port = Number(portRaw || explicitPort || 9000);
  const useSSL = endpointRaw.startsWith('https://') || port === 443;

  return {
    endPoint: host || 'localhost',
    port,
    useSSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY
  };
}

export const minio = new Client(minioConfig());

async function ensureBucket(bucket: string) {
  try {
    const exists = await minio.bucketExists(bucket).catch(() => false);
    if (!exists) await minio.makeBucket(bucket);
  } catch (error) {
    console.error('[storage] MinIO bucket check/create failed', { bucket, error });
    throw new AppError(503, 'STORAGE_UNAVAILABLE', 'File storage is not available. Ensure MinIO is running and credentials are correct.');
  }
}

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'attachment.bin';
}

export const storageService = {
  async putAttachment(file: Express.Multer.File) {
    const bucket = env.MINIO_BUCKET_ATTACH;
    await ensureBucket(bucket);
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${cleanFilename(file.originalname)}`;

    try {
      await minio.putObject(bucket, key, file.buffer, file.size, {
        'Content-Type': file.mimetype || 'application/octet-stream'
      });
      return { bucket, key };
    } catch (error) {
      console.error('[storage] MinIO putObject failed', { bucket, key, filename: file.originalname, size: file.size, error });
      throw new AppError(503, 'STORAGE_UPLOAD_FAILED', 'Attachment upload failed. Check MinIO service and bucket configuration.');
    }
  },

  async presignedAttachmentUrl(key: string) {
    const bucket = env.MINIO_BUCKET_ATTACH;
    await ensureBucket(bucket);
    try {
      return await minio.presignedGetObject(bucket, key, 3600);
    } catch (error) {
      console.error('[storage] MinIO presignedGetObject failed', { bucket, key, error });
      throw new AppError(503, 'STORAGE_URL_FAILED', 'Could not create attachment download URL.');
    }
  },

  async removeAttachment(key: string) {
    const bucket = env.MINIO_BUCKET_ATTACH;
    await ensureBucket(bucket);
    await minio.removeObject(bucket, key).catch((error) => {
      console.warn('[storage] MinIO removeObject failed; continuing with DB delete', { bucket, key, error });
    });
  }
};
