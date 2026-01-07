# File Uploads (Node.js)

Multipart uploads, S3 storage, validation, and streaming patterns.

---

## Fastify Multipart Setup

### DO ✅

```typescript
// plugins/multipart.ts
import fastifyMultipart from '@fastify/multipart';

export async function registerMultipart(app: FastifyInstance) {
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
      files: 5, // Max 5 files per request
      fieldSize: 1024 * 1024, // 1MB for non-file fields
    },
    attachFieldsToBody: true,
  });
}
```

---

## Basic File Upload

### DO ✅

```typescript
// routes/upload.routes.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface UploadResult {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

async function uploadHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<UploadResult> {
  const file = await request.file();

  if (!file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError('Invalid file type', 400, 'INVALID_FILE_TYPE');
  }

  // Generate unique filename
  const ext = path.extname(file.filename);
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const uploadPath = path.join(config.UPLOAD_DIR, filename);

  // Stream to disk
  await pipeline(file.file, fs.createWriteStream(uploadPath));

  // Check if stream was truncated (file too large)
  if (file.file.truncated) {
    await fs.promises.unlink(uploadPath);
    throw new AppError('File too large', 413, 'FILE_TOO_LARGE');
  }

  const stats = await fs.promises.stat(uploadPath);

  return {
    id,
    filename: file.filename,
    mimetype: file.mimetype,
    size: stats.size,
    url: `/uploads/${filename}`,
  };
}

// Route
app.post('/api/upload', {
  schema: {
    consumes: ['multipart/form-data'],
    response: { 200: uploadResponseSchema },
  },
  handler: uploadHandler,
});
```

---

## Multiple Files Upload

### DO ✅

```typescript
async function uploadMultipleHandler(
  request: FastifyRequest
): Promise<UploadResult[]> {
  const parts = request.files();
  const results: UploadResult[] = [];

  for await (const file of parts) {
    if (!isAllowedType(file.mimetype)) {
      throw new AppError(`Invalid file type: ${file.filename}`, 400, 'INVALID_FILE_TYPE');
    }

    const id = randomUUID();
    const ext = path.extname(file.filename);
    const filename = `${id}${ext}`;
    const uploadPath = path.join(config.UPLOAD_DIR, filename);

    await pipeline(file.file, fs.createWriteStream(uploadPath));

    if (file.file.truncated) {
      await fs.promises.unlink(uploadPath);
      throw new AppError(`File too large: ${file.filename}`, 413, 'FILE_TOO_LARGE');
    }

    const stats = await fs.promises.stat(uploadPath);

    results.push({
      id,
      filename: file.filename,
      mimetype: file.mimetype,
      size: stats.size,
      url: `/uploads/${filename}`,
    });
  }

  return results;
}
```

---

## S3 Upload

### DO ✅

```typescript
// lib/s3.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';

const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = config.S3_BUCKET;

// Stream upload to S3
export async function uploadToS3(
  key: string,
  stream: NodeJS.ReadableStream,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
      Metadata: metadata,
    },
  });

  upload.on('httpUploadProgress', (progress) => {
    console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
  });

  await upload.done();

  return `https://${BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
}

// Presigned upload URL (client-side upload)
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Presigned download URL
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Delete from S3
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
```

### S3 Upload Route

```typescript
async function uploadToS3Handler(
  request: FastifyRequest
): Promise<{ url: string; key: string }> {
  const file = await request.file();

  if (!file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE');
  }

  const ext = path.extname(file.filename);
  const key = `uploads/${Date.now()}-${randomUUID()}${ext}`;

  const url = await uploadToS3(key, file.file, file.mimetype, {
    originalName: file.filename,
  });

  // Save metadata to database
  await db.files.insertOne({
    key,
    url,
    filename: file.filename,
    mimetype: file.mimetype,
    uploadedAt: new Date(),
    userId: request.user?.id,
  });

  return { url, key };
}
```

---

## Presigned URLs (Client-Side Upload)

### DO ✅

```typescript
// Get presigned URL for client upload
app.post('/api/upload/presign', {
  schema: {
    body: z.object({
      filename: z.string(),
      contentType: z.string(),
    }),
  },
  handler: async (request) => {
    const { filename, contentType } = request.body;

    if (!isAllowedType(contentType)) {
      throw new AppError('Invalid file type', 400, 'INVALID_FILE_TYPE');
    }

    const ext = path.extname(filename);
    const key = `uploads/${request.user.id}/${Date.now()}${ext}`;
    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    // Track pending upload
    const uploadId = randomUUID();
    await db.pendingUploads.insertOne({
      id: uploadId,
      key,
      filename,
      contentType,
      userId: request.user.id,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });

    return { uploadId, uploadUrl, key };
  },
});

// Confirm upload completed
app.post('/api/upload/confirm', {
  handler: async (request) => {
    const { uploadId } = request.body;

    const pending = await db.pendingUploads.findOne({
      id: uploadId,
      userId: request.user.id,
    });

    if (!pending) {
      throw new AppError('Upload not found', 404, 'UPLOAD_NOT_FOUND');
    }

    await db.files.insertOne({
      key: pending.key,
      filename: pending.filename,
      contentType: pending.contentType,
      userId: pending.userId,
      uploadedAt: new Date(),
    });

    await db.pendingUploads.deleteOne({ id: uploadId });

    return { success: true, key: pending.key };
  },
});
```

---

## Image Processing

### DO ✅

```typescript
import sharp from 'sharp';

interface ImageVariant {
  suffix: string;
  width: number;
  height?: number;
  quality?: number;
}

const VARIANTS: ImageVariant[] = [
  { suffix: 'thumb', width: 150, height: 150, quality: 80 },
  { suffix: 'medium', width: 800, quality: 85 },
  { suffix: 'large', width: 1920, quality: 90 },
];

async function processImage(
  buffer: Buffer,
  baseKey: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  for (const variant of VARIANTS) {
    const processed = await sharp(buffer)
      .resize(variant.width, variant.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: variant.quality ?? 85 })
      .toBuffer();

    const key = `${baseKey}-${variant.suffix}.webp`;
    const url = await uploadToS3(key, Readable.from(processed), 'image/webp');
    results[variant.suffix] = url;
  }

  return results;
}

// Upload with variants
async function uploadImageWithVariants(request: FastifyRequest) {
  const file = await request.file();

  if (!file?.mimetype.startsWith('image/')) {
    throw new AppError('Invalid image', 400, 'INVALID_IMAGE');
  }

  const buffer = await file.toBuffer();
  const baseKey = `images/${Date.now()}-${randomUUID()}`;

  // Upload original
  const originalUrl = await uploadToS3(
    `${baseKey}-original${path.extname(file.filename)}`,
    Readable.from(buffer),
    file.mimetype
  );

  // Generate variants
  const variants = await processImage(buffer, baseKey);

  return { original: originalUrl, variants };
}
```

---

## File Validation

### DO ✅

```typescript
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  document: ['application/pdf', 'application/msword'],
  video: ['video/mp4', 'video/webm'],
};

const MAX_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,     // 10MB
  document: 50 * 1024 * 1024,  // 50MB
  video: 500 * 1024 * 1024,    // 500MB
};

async function validateFile(
  buffer: Buffer,
  declaredType: string,
  category: keyof typeof ALLOWED_TYPES
): Promise<void> {
  // Check declared type
  if (!ALLOWED_TYPES[category].includes(declaredType)) {
    throw new AppError(`File type not allowed: ${declaredType}`, 400, 'INVALID_TYPE');
  }

  // Detect actual type from magic bytes
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || detected.mime !== declaredType) {
    throw new AppError('File type mismatch', 400, 'TYPE_MISMATCH');
  }

  // Check size
  if (buffer.length > MAX_SIZES[category]) {
    throw new AppError('File too large', 413, 'FILE_TOO_LARGE');
  }
}
```

---

## Download Streaming

### DO ✅

```typescript
app.get('/api/files/:key', async (request, reply) => {
  const { key } = request.params as { key: string };

  const file = await db.files.findOne({ key });
  if (!file) {
    throw new AppError('File not found', 404, 'NOT_FOUND');
  }

  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );

  reply.header('Content-Type', file.contentType);
  reply.header('Content-Disposition', `attachment; filename="${file.filename}"`);
  reply.header('Content-Length', response.ContentLength);

  return reply.send(response.Body);
});
```

---

## Quick Reference

| Operation | Method |
|-----------|--------|
| Single file | `request.file()` |
| Multiple files | `request.files()` |
| To buffer | `file.toBuffer()` |
| Stream to S3 | `Upload` class |
| Client upload | Presigned URL |

| Validation | Tool |
|------------|------|
| Magic bytes | `file-type` |
| Image resize | `sharp` |
| Virus scan | ClamAV |

| Storage | When |
|---------|------|
| Local | Dev, temp |
| S3 | Production |
| Presigned | Large files |
