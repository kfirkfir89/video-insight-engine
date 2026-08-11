# File Uploads

FastAPI file handling, S3 storage, validation, and streaming patterns.

<rules>
- ALWAYS validate file type with both declared Content-Type AND magic bytes (`python-magic`) (Content-Type headers can be spoofed to upload disguised executables)
- ALWAYS enforce file size limits before processing — check `file.size` or `len(contents)` (unbounded uploads exhaust server memory and disk)
- ALWAYS generate unique filenames (UUID) for stored files, never use user-provided names (user filenames can contain path traversal attacks like `../../etc/passwd`)
- ALWAYS use presigned URLs for large file uploads to avoid proxying through your server (proxying large files through the API server consumes memory and blocks workers)
- NEVER store uploaded files with their original filename (enables path traversal and filename collision attacks)
- NEVER trust Content-Type header alone for type validation (browsers and tools can send arbitrary Content-Type values)
</rules>

---

## Basic Upload

```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "application/pdf"}

@router.post("", response_model=UploadResult)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> UploadResult:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Type not allowed: {file.content_type}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    # Save with UUID filename, store original name in metadata
```

---

## S3 Upload

Use `aioboto3` for async S3 operations. Generate presigned URLs for client-side uploads to avoid proxying.

```python
async def upload_to_s3(key: str, data: bytes, content_type: str) -> str:
    async with session.client("s3", region_name=settings.AWS_REGION) as s3:
        await s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=data, ContentType=content_type)
    return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
```

---

## Presigned URLs

For large uploads: generate a presigned PUT URL, client uploads directly to S3, then confirms via your API. Track pending uploads with expiry in the database.

---

## File Validation

```python
import magic

async def validate_file(data: bytes, declared_type: str, category: str) -> None:
    detected = magic.from_buffer(data, mime=True)
    if detected != declared_type:
        raise HTTPException(400, f"Type mismatch: declared {declared_type}, detected {detected}")
```

---

## Streaming Download

Use `StreamingResponse` with an async file iterator for local files. For S3 files, redirect to a presigned GET URL.

```python
async def file_iterator(path: Path):
    async with aiofiles.open(path, "rb") as f:
        while chunk := await f.read(8192):
            yield chunk
```

---

## Image Processing

Use Pillow to generate variants (thumbnail, medium, large) in WebP format. Process in memory, upload each variant to S3.

---

## Edge Cases

- **Chunked upload for large files**: Initialize with `/chunk/init`, upload numbered chunks, then `/chunk/complete` to assemble. Clean up chunks after assembly.
- **Multiple file upload**: Accept `list[UploadFile]`, enforce a max count (e.g., 10), validate each individually.
- **Presigned URL expiry**: Set 1-hour expiry. Clean up pending uploads that are never confirmed via a TTL index or scheduled task.

---

## Rules Summary

Validate file type with both Content-Type and magic bytes. Enforce size limits before processing. Store files with UUID names, keep originals in metadata. Use presigned URLs for large uploads to avoid proxying. Stream downloads with async iterators or S3 redirects. Generate image variants server-side. Clean up failed chunked uploads with TTL.
