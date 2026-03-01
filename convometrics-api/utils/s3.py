import os

import boto3

S3_BUCKET = os.getenv("S3_BUCKET_NAME", "convometrics-uploads")

_client = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION", "us-east-1"),
)


def upload_fileobj(fileobj, key: str) -> str:
    """Stream a file-like object to S3 without loading it fully into memory."""
    _client.upload_fileobj(fileobj, S3_BUCKET, key)
    return key


def upload_file(data: bytes, key: str) -> str:
    _client.put_object(Bucket=S3_BUCKET, Key=key, Body=data)
    return key


def download_file(key: str) -> bytes:
    response = _client.get_object(Bucket=S3_BUCKET, Key=key)
    return response["Body"].read()
