# File Uploads

Multipart uploads, S3 storage, presigned URLs, image processing, and file validation.

<rules>
- ALWAYS validate file type by checking magic bytes with `file-type` — never trust Content-Type header alone (causes malicious file upload via spoofed headers)
- ALWAYS set file size limits per route via `@fastify/multipart` limits config (causes memory exhaustion from oversized uploads)
- ALWAYS check `file.file.truncated` after streaming — truncated means size limit was hit (causes silently saving partial/corrupt files)
- ALWAYS use streaming (`pipeline`) for uploads — never buffer entire files in memory (causes OOM on large files)
- ALWAYS generate unique filenames with UUID — never use user-provided filenames directly (causes path traversal attacks)
- NEVER store files locally in production — use S3 or equivalent object storage (causes data loss on container restart)
- NEVER serve user uploads without Content-Disposition header (causes XSS via uploaded HTML/SVG files)
</rules>

---

## Fastify Multipart Setup

```typescript
import fastifyMultipart from '@fastify/multipart';

await app.register(fastifyMultipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 5, fieldSize: 1024 * 1024 },
  attachFieldsToBody: true,
});
```

---

## Upload to S3

Stream directly to S3 via `@aws-sdk/lib-storage`:

```typescript
import { Upload } from '@aws-sdk/lib-storage';

async function uploadHandler(request: FastifyRequest) {
  const file = await request.file();
  if (!file) throw new AppError('No file uploaded', 400, 'NO_FILE');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
    throw new AppError('Invalid file type', 400, 'INVALID_FILE_TYPE');
  const key = `uploads/${Date.now()}-${randomUUID()}${path.extname(file.filename)}`;
  const upload = new Upload({
    client: s3Client,
    params: { Bucket: BUCKET, Key: key, Body: file.file, ContentType: file.mimetype },
  });
  await upload.done();
  if (file.file.truncated) { await deleteFromS3(key); throw new AppError('File too large', 413, 'FILE_TOO_LARGE'); }
  return { url: `https://${BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`, key };
}
```

---

## Presigned URLs (Client-Side Upload)

Generate presigned URL, client uploads directly to S3, then confirms:

```typescript
app.post('/api/upload/presign', {
  handler: async (request) => {
    const { filename, contentType } = request.body;
    if (!isAllowedType(contentType)) throw new AppError('Invalid type', 400, 'INVALID_TYPE');
    const key = `uploads/${request.user.id}/${Date.now()}${path.extname(filename)}`;
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 3600);
    return { uploadUrl, key };
  },
});
```

---

## File Validation

```typescript
import { fileTypeFromBuffer } from 'file-type';

async function validateFile(buffer: Buffer, declaredType: string, maxSize: number) {
  if (buffer.length > maxSize) throw new AppError('File too large', 413, 'FILE_TOO_LARGE');
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || detected.mime !== declaredType)
    throw new AppError('File type mismatch', 400, 'TYPE_MISMATCH');
}
```

---

## Image Processing

```typescript
import sharp from 'sharp';

const VARIANTS = [
  { suffix: 'thumb', width: 150, height: 150, quality: 80 },
  { suffix: 'medium', width: 800, quality: 85 },
];

async function processImage(buffer: Buffer, baseKey: string) {
  const results: Record<string, string> = {};
  for (const v of VARIANTS) {
    const processed = await sharp(buffer)
      .resize(v.width, v.height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: v.quality ?? 85 }).toBuffer();
    results[v.suffix] = await uploadToS3(`${baseKey}-${v.suffix}.webp`, Readable.from(processed), 'image/webp');
  }
  return results;
}
```

---

## Edge Cases

- **Truncated stream after S3 upload**: Check `file.file.truncated` AFTER the upload completes, then delete the partial S3 object if true.
- **Concurrent uploads with same filename**: UUID-based keys prevent collisions. Never use the original filename as the S3 key.
- **SVG uploads**: SVG files can contain JavaScript. If allowing SVG, sanitize with a library like `sanitize-svg` or serve with `Content-Disposition: attachment`.

---

## Rules Summary

File uploads use @fastify/multipart with size limits, stream directly to S3 via the Upload class, and validate both declared and actual MIME types using magic bytes. Filenames are UUID-generated to prevent path traversal. Truncation is checked post-upload to detect size limit violations. Presigned URLs enable client-side uploads for large files. Image processing uses sharp to generate WebP variants at multiple sizes. User-uploaded files are never served without Content-Disposition headers.
