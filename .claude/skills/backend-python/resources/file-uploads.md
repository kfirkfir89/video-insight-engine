# File Uploads (Python)

FastAPI file handling, S3 storage, validation, and streaming patterns.

---

## FastAPI File Upload Setup

### DO ✅

```python
# routes/upload.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uuid
import aiofiles
from pathlib import Path

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}


class UploadResult(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    url: str
```

---

## Basic File Upload

### DO ✅

```python
@router.post("", response_model=UploadResult)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> UploadResult:
    """Upload a single file."""
    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type not allowed: {file.content_type}")

    # Read and check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    # Generate unique filename
    ext = Path(file.filename).suffix
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / filename

    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(contents)

    # Save metadata to database
    await db.files.insert_one({
        "id": file_id,
        "filename": file.filename,
        "stored_filename": filename,
        "content_type": file.content_type,
        "size": len(contents),
        "user_id": current_user.id,
        "created_at": datetime.now(UTC),
    })

    return UploadResult(
        id=file_id,
        filename=file.filename,
        content_type=file.content_type,
        size=len(contents),
        url=f"/api/files/{file_id}",
    )
```

---

## Multiple Files Upload

### DO ✅

```python
@router.post("/multiple", response_model=list[UploadResult])
async def upload_multiple_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
) -> list[UploadResult]:
    """Upload multiple files."""
    if len(files) > 10:
        raise HTTPException(400, "Maximum 10 files allowed")

    results: list[UploadResult] = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, f"Invalid file type: {file.filename}")

        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(413, f"File too large: {file.filename}")

        ext = Path(file.filename).suffix
        file_id = str(uuid.uuid4())
        filename = f"{file_id}{ext}"
        file_path = UPLOAD_DIR / filename

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(contents)

        await db.files.insert_one({
            "id": file_id,
            "filename": file.filename,
            "stored_filename": filename,
            "content_type": file.content_type,
            "size": len(contents),
            "user_id": current_user.id,
            "created_at": datetime.now(UTC),
        })

        results.append(UploadResult(
            id=file_id,
            filename=file.filename,
            content_type=file.content_type,
            size=len(contents),
            url=f"/api/files/{file_id}",
        ))

    return results
```

---

## S3 Upload

### DO ✅

```python
# lib/s3.py
import aioboto3
from botocore.config import Config
from app.core.config import settings

session = aioboto3.Session()


async def get_s3_client():
    """Get async S3 client."""
    async with session.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    ) as client:
        yield client


async def upload_to_s3(
    key: str,
    data: bytes,
    content_type: str,
    metadata: dict | None = None,
) -> str:
    """Upload file to S3."""
    async with session.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    ) as s3:
        await s3.put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
            Metadata=metadata or {},
        )

    return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


async def get_presigned_upload_url(
    key: str,
    content_type: str,
    expires_in: int = 3600,
) -> str:
    """Generate presigned URL for client-side upload."""
    async with session.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    ) as s3:
        url = await s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
    return url


async def get_presigned_download_url(
    key: str,
    expires_in: int = 3600,
) -> str:
    """Generate presigned URL for download."""
    async with session.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    ) as s3:
        url = await s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=expires_in,
        )
    return url


async def delete_from_s3(key: str) -> None:
    """Delete file from S3."""
    async with session.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    ) as s3:
        await s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)
```

### S3 Upload Route

```python
@router.post("/s3", response_model=UploadResult)
async def upload_to_s3_handler(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> UploadResult:
    """Upload file directly to S3."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Invalid file type")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    ext = Path(file.filename).suffix
    file_id = str(uuid.uuid4())
    key = f"uploads/{current_user.id}/{file_id}{ext}"

    url = await upload_to_s3(
        key=key,
        data=contents,
        content_type=file.content_type,
        metadata={"original_name": file.filename},
    )

    await db.files.insert_one({
        "id": file_id,
        "key": key,
        "url": url,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "user_id": current_user.id,
        "created_at": datetime.now(UTC),
    })

    return UploadResult(
        id=file_id,
        filename=file.filename,
        content_type=file.content_type,
        size=len(contents),
        url=url,
    )
```

---

## Presigned URLs (Client-Side Upload)

### DO ✅

```python
class PresignRequest(BaseModel):
    filename: str
    content_type: str


class PresignResponse(BaseModel):
    upload_id: str
    upload_url: str
    key: str


@router.post("/presign", response_model=PresignResponse)
async def get_presigned_url(
    request: PresignRequest,
    current_user: User = Depends(get_current_user),
) -> PresignResponse:
    """Get presigned URL for client-side upload."""
    if request.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Invalid file type")

    ext = Path(request.filename).suffix
    upload_id = str(uuid.uuid4())
    key = f"uploads/{current_user.id}/{upload_id}{ext}"

    upload_url = await get_presigned_upload_url(key, request.content_type)

    # Track pending upload
    await db.pending_uploads.insert_one({
        "id": upload_id,
        "key": key,
        "filename": request.filename,
        "content_type": request.content_type,
        "user_id": current_user.id,
        "expires_at": datetime.now(UTC) + timedelta(hours=1),
    })

    return PresignResponse(upload_id=upload_id, upload_url=upload_url, key=key)


@router.post("/confirm/{upload_id}")
async def confirm_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
):
    """Confirm client-side upload completed."""
    pending = await db.pending_uploads.find_one({
        "id": upload_id,
        "user_id": current_user.id,
    })

    if not pending:
        raise HTTPException(404, "Upload not found")

    await db.files.insert_one({
        "id": pending["id"],
        "key": pending["key"],
        "filename": pending["filename"],
        "content_type": pending["content_type"],
        "user_id": pending["user_id"],
        "created_at": datetime.now(UTC),
    })

    await db.pending_uploads.delete_one({"id": upload_id})

    return {"success": True, "key": pending["key"]}
```

---

## Image Processing

### DO ✅

```python
from PIL import Image
import io


class ImageVariant(BaseModel):
    suffix: str
    width: int
    height: int | None = None
    quality: int = 85


VARIANTS = [
    ImageVariant(suffix="thumb", width=150, height=150),
    ImageVariant(suffix="medium", width=800),
    ImageVariant(suffix="large", width=1920),
]


async def process_image(
    data: bytes,
    base_key: str,
) -> dict[str, str]:
    """Generate image variants and upload to S3."""
    results: dict[str, str] = {}
    image = Image.open(io.BytesIO(data))

    # Convert to RGB if necessary
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    for variant in VARIANTS:
        # Resize
        img_copy = image.copy()
        if variant.height:
            img_copy.thumbnail((variant.width, variant.height))
        else:
            ratio = variant.width / img_copy.width
            new_height = int(img_copy.height * ratio)
            img_copy = img_copy.resize((variant.width, new_height), Image.LANCZOS)

        # Save to buffer
        buffer = io.BytesIO()
        img_copy.save(buffer, format="WEBP", quality=variant.quality)
        buffer.seek(0)

        # Upload variant
        key = f"{base_key}-{variant.suffix}.webp"
        url = await upload_to_s3(key, buffer.getvalue(), "image/webp")
        results[variant.suffix] = url

    return results


@router.post("/image", response_model=dict)
async def upload_image_with_variants(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload image and generate variants."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Not an image")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    file_id = str(uuid.uuid4())
    base_key = f"images/{current_user.id}/{file_id}"

    # Upload original
    ext = Path(file.filename).suffix
    original_url = await upload_to_s3(
        f"{base_key}-original{ext}",
        contents,
        file.content_type,
    )

    # Generate variants
    variants = await process_image(contents, base_key)

    return {"original": original_url, "variants": variants}
```

---

## File Validation

### DO ✅

```python
import magic


MIME_TYPES: dict[str, list[str]] = {
    "image": ["image/jpeg", "image/png", "image/webp", "image/gif"],
    "document": ["application/pdf", "application/msword"],
    "video": ["video/mp4", "video/webm"],
}

MAX_SIZES: dict[str, int] = {
    "image": 10 * 1024 * 1024,
    "document": 50 * 1024 * 1024,
    "video": 500 * 1024 * 1024,
}


async def validate_file(
    data: bytes,
    declared_type: str,
    category: str,
) -> None:
    """Validate file type and size."""
    allowed = MIME_TYPES.get(category, [])
    max_size = MAX_SIZES.get(category, 10 * 1024 * 1024)

    # Check declared type
    if declared_type not in allowed:
        raise HTTPException(400, f"File type not allowed: {declared_type}")

    # Detect actual type from magic bytes
    detected = magic.from_buffer(data, mime=True)
    if detected != declared_type:
        raise HTTPException(400, f"File type mismatch: declared {declared_type}, detected {detected}")

    # Check size
    if len(data) > max_size:
        raise HTTPException(413, f"File too large. Max size: {max_size // 1024 // 1024}MB")
```

---

## Streaming Download

### DO ✅

```python
from fastapi.responses import StreamingResponse


@router.get("/files/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    """Download file."""
    file = await db.files.find_one({"id": file_id})
    if not file:
        raise HTTPException(404, "File not found")

    # Local file
    if "stored_filename" in file:
        file_path = UPLOAD_DIR / file["stored_filename"]

        async def file_iterator():
            async with aiofiles.open(file_path, "rb") as f:
                while chunk := await f.read(8192):
                    yield chunk

        return StreamingResponse(
            file_iterator(),
            media_type=file["content_type"],
            headers={
                "Content-Disposition": f'attachment; filename="{file["filename"]}"'
            },
        )

    # S3 file - redirect to presigned URL
    url = await get_presigned_download_url(file["key"])
    return RedirectResponse(url)
```

---

## Chunked Upload (Large Files)

### DO ✅

```python
@router.post("/chunk/init")
async def init_chunked_upload(
    filename: str,
    total_size: int,
    current_user: User = Depends(get_current_user),
):
    """Initialize chunked upload."""
    upload_id = str(uuid.uuid4())

    await db.chunked_uploads.insert_one({
        "id": upload_id,
        "filename": filename,
        "total_size": total_size,
        "uploaded_size": 0,
        "chunks": [],
        "user_id": current_user.id,
        "created_at": datetime.now(UTC),
    })

    return {"upload_id": upload_id}


@router.post("/chunk/{upload_id}")
async def upload_chunk(
    upload_id: str,
    chunk_number: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a chunk."""
    upload = await db.chunked_uploads.find_one({
        "id": upload_id,
        "user_id": current_user.id,
    })

    if not upload:
        raise HTTPException(404, "Upload not found")

    contents = await file.read()
    chunk_path = UPLOAD_DIR / f"{upload_id}_chunk_{chunk_number}"

    async with aiofiles.open(chunk_path, "wb") as f:
        await f.write(contents)

    await db.chunked_uploads.update_one(
        {"id": upload_id},
        {
            "$push": {"chunks": chunk_number},
            "$inc": {"uploaded_size": len(contents)},
        },
    )

    return {"chunk": chunk_number, "size": len(contents)}


@router.post("/chunk/{upload_id}/complete")
async def complete_chunked_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
):
    """Assemble chunks into final file."""
    upload = await db.chunked_uploads.find_one({
        "id": upload_id,
        "user_id": current_user.id,
    })

    if not upload:
        raise HTTPException(404, "Upload not found")

    # Assemble chunks
    ext = Path(upload["filename"]).suffix
    final_path = UPLOAD_DIR / f"{upload_id}{ext}"

    async with aiofiles.open(final_path, "wb") as final_file:
        for chunk_num in sorted(upload["chunks"]):
            chunk_path = UPLOAD_DIR / f"{upload_id}_chunk_{chunk_num}"
            async with aiofiles.open(chunk_path, "rb") as chunk_file:
                await final_file.write(await chunk_file.read())
            # Clean up chunk
            chunk_path.unlink()

    # Clean up upload record
    await db.chunked_uploads.delete_one({"id": upload_id})

    return {"success": True, "file_id": upload_id}
```

---

## Quick Reference

| Operation | Method |
|-----------|--------|
| Single file | `UploadFile = File(...)` |
| Multiple files | `list[UploadFile] = File(...)` |
| Read contents | `await file.read()` |
| Stream response | `StreamingResponse` |

| Validation | Tool |
|------------|------|
| Magic bytes | `python-magic` |
| Image processing | `Pillow` |
| Async file I/O | `aiofiles` |

| Storage | When |
|---------|------|
| Local | Dev, temp |
| S3 | Production |
| Presigned | Large files, client upload |
