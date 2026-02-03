import os
import uuid
import boto3
from botocore.client import Config

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "adminadmin")
MINIO_BUCKET_DOCS = os.getenv("MINIO_BUCKET_DOCS", "docs")


_session = None


def _client():
    global _session
    if _session is None:
        _session = boto3.session.Session()
    return _session.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def save_doc(file_bytes: bytes, filename: str, content_type: str = "application/octet-stream") -> str:
    key = f"docs/{uuid.uuid4().hex}_{filename}"
    client = _client()
    client.put_object(Bucket=MINIO_BUCKET_DOCS, Key=key, Body=file_bytes, ContentType=content_type)
    return key
