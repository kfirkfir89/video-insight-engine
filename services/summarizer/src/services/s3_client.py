"""S3 client service for transcript storage.

Provides async S3 operations using aioboto3 for storing and retrieving
raw transcripts. Supports both LocalStack (development) and real AWS S3.

Note: aioboto3 is imported lazily to allow graceful degradation if not installed.
"""

import json
import logging
from typing import Any

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import settings

logger = logging.getLogger(__name__)

# Track if aioboto3 is available
_aioboto3_available: bool | None = None


def _check_aioboto3() -> bool:
    """Check if aioboto3 is available (lazy check)."""
    global _aioboto3_available
    if _aioboto3_available is None:
        try:
            import aioboto3  # noqa: F401
            _aioboto3_available = True
        except ImportError:
            logger.warning("aioboto3 not installed - S3 storage will be disabled")
            _aioboto3_available = False
    return _aioboto3_available


class S3Client:
    """Async S3 client for transcript storage operations."""

    def __init__(self):
        self._session = None
        self._bucket = settings.TRANSCRIPT_S3_BUCKET

    def _ensure_session(self):
        """Lazily initialize the aioboto3 session."""
        if self._session is None:
            if not _check_aioboto3():
                raise RuntimeError("aioboto3 not available - cannot use S3 storage")
            import aioboto3
            self._session = aioboto3.Session()
        return self._session

    def _get_client_config(self) -> dict[str, Any]:
        """Get S3 client configuration."""
        config: dict[str, Any] = {
            "region_name": settings.AWS_REGION,
        }

        # Use LocalStack endpoint if configured
        if settings.AWS_ENDPOINT_URL:
            config["endpoint_url"] = settings.AWS_ENDPOINT_URL

        # Use explicit credentials if provided
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

        return config

    async def ensure_bucket_exists(self) -> None:
        """Create the bucket if it doesn't exist (for LocalStack)."""
        from botocore.exceptions import ClientError
        session = self._ensure_session()
        async with session.client("s3", **self._get_client_config()) as s3:
            try:
                await s3.head_bucket(Bucket=self._bucket)
                logger.debug(f"S3 bucket exists: {self._bucket}")
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code in ("404", "NoSuchBucket"):
                    logger.info(f"Creating S3 bucket: {self._bucket}")
                    # us-east-1 doesn't need LocationConstraint, others do
                    create_config: dict[str, Any] = {"Bucket": self._bucket}
                    if settings.AWS_REGION and settings.AWS_REGION != "us-east-1":
                        create_config["CreateBucketConfiguration"] = {
                            "LocationConstraint": settings.AWS_REGION
                        }
                    await s3.create_bucket(**create_config)
                else:
                    raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((Exception,)),
        before_sleep=lambda retry_state: logger.warning(
            f"S3 put_json retry {retry_state.attempt_number}/3: {retry_state.outcome.exception()}"
        ),
        reraise=True,
    )
    async def put_json(self, key: str, data: dict[str, Any]) -> None:
        """
        Upload JSON data to S3 with retry logic for transient errors.

        Args:
            key: S3 object key (e.g., "transcripts/abc123.json")
            data: Dictionary to serialize as JSON

        Raises:
            ClientError: If upload fails after retries
        """
        session = self._ensure_session()
        async with session.client("s3", **self._get_client_config()) as s3:
            body = json.dumps(data, ensure_ascii=False)
            await s3.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body.encode("utf-8"),
                ContentType="application/json",
            )
            logger.debug(f"Uploaded to S3: {key} ({len(body)} bytes)")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((Exception,)),
        before_sleep=lambda retry_state: logger.warning(
            f"S3 get_json retry {retry_state.attempt_number}/3: {retry_state.outcome.exception()}"
        ),
        reraise=True,
    )
    async def get_json(self, key: str) -> dict[str, Any] | None:
        """
        Download and parse JSON from S3 with retry logic for transient errors.

        Args:
            key: S3 object key

        Returns:
            Parsed JSON dict, or None if object doesn't exist

        Raises:
            ClientError: If download fails after retries (except for NoSuchKey)
        """
        from botocore.exceptions import ClientError
        session = self._ensure_session()
        async with session.client("s3", **self._get_client_config()) as s3:
            try:
                response = await s3.get_object(Bucket=self._bucket, Key=key)
                async with response["Body"] as stream:
                    body = await stream.read()
                    return json.loads(body.decode("utf-8"))
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "NoSuchKey":
                    logger.debug(f"S3 object not found: {key}")
                    return None
                raise

    async def exists(self, key: str) -> bool:
        """
        Check if an object exists in S3.

        Args:
            key: S3 object key

        Returns:
            True if object exists, False otherwise
        """
        from botocore.exceptions import ClientError
        session = self._ensure_session()
        async with session.client("s3", **self._get_client_config()) as s3:
            try:
                await s3.head_object(Bucket=self._bucket, Key=key)
                return True
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "404":
                    return False
                raise

    async def delete(self, key: str) -> None:
        """
        Delete an object from S3.

        Args:
            key: S3 object key

        Raises:
            ClientError: If deletion fails
        """
        session = self._ensure_session()
        async with session.client("s3", **self._get_client_config()) as s3:
            await s3.delete_object(Bucket=self._bucket, Key=key)
            logger.debug(f"Deleted from S3: {key}")

    async def health_check(self) -> dict[str, Any]:
        """
        Check S3 connectivity and bucket access.

        Returns:
            Health check result with status and details
        """
        if not _check_aioboto3():
            return {
                "status": "unavailable",
                "bucket": self._bucket,
                "error": "aioboto3 not installed",
            }

        from botocore.exceptions import ClientError
        try:
            session = self._ensure_session()
            async with session.client("s3", **self._get_client_config()) as s3:
                await s3.head_bucket(Bucket=self._bucket)
                return {
                    "status": "healthy",
                    "bucket": self._bucket,
                    "endpoint": settings.AWS_ENDPOINT_URL or "aws",
                }
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            return {
                "status": "unhealthy",
                "bucket": self._bucket,
                "error": error_code,
                "message": str(e),
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "bucket": self._bucket,
                "error": type(e).__name__,
                "message": str(e),
            }

    @staticmethod
    def is_available() -> bool:
        """Check if S3 storage is available (aioboto3 installed)."""
        return _check_aioboto3()


# Singleton instance
s3_client = S3Client()
