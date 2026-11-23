"""Encrypted object storage for the document vault.

Every file is encrypted with AES-256-GCM inside the app before it is stored, so
the storage provider (Cloudflare R2, AWS S3, Backblaze B2, or the local disk)
only ever holds ciphertext. GCM also authenticates the data: a tampered or
corrupted object fails to decrypt instead of returning altered bytes.

Stored object layout:  b"JAV1" | 12-byte nonce | ciphertext+tag
The object key is passed as associated data, so ciphertext copied to another
key will not decrypt either.

Env:
  VAULT_ENCRYPTION_KEY  base64 of 32 random bytes (required)
  STORAGE_BACKEND       "s3" (any S3-compatible service) or "local" (development)
  S3_ENDPOINT_URL, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION
  VAULT_LOCAL_DIR       local backend folder (default: <project>/storage/vault)
"""
import base64
import os
import threading
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_MAGIC = b"JAV1"
_PROJECT_ROOT = Path(__file__).resolve().parents[2]


class StorageError(Exception):
    """Storage failed; the message is safe to show to the user."""


def _load_key() -> bytes:
    raw = os.getenv("VAULT_ENCRYPTION_KEY", "").strip()
    if not raw:
        raise StorageError("The document vault is not configured (VAULT_ENCRYPTION_KEY missing).")
    try:
        key = base64.b64decode(raw)
    except Exception as exc:
        raise StorageError("VAULT_ENCRYPTION_KEY is not valid base64.") from exc
    if len(key) != 32:
        raise StorageError("VAULT_ENCRYPTION_KEY must be 32 bytes (base64-encoded).")
    return key


def encrypt(plaintext: bytes, key_name: str) -> bytes:
    nonce = os.urandom(12)
    return _MAGIC + nonce + AESGCM(_load_key()).encrypt(nonce, plaintext, key_name.encode())


def decrypt(blob: bytes, key_name: str) -> bytes:
    if not blob.startswith(_MAGIC) or len(blob) < len(_MAGIC) + 12 + 16:
        raise StorageError("Stored file is not in the expected encrypted format.")
    nonce = blob[len(_MAGIC):len(_MAGIC) + 12]
    try:
        return AESGCM(_load_key()).decrypt(nonce, blob[len(_MAGIC) + 12:], key_name.encode())
    except Exception as exc:  # InvalidTag: wrong key, tampering or corruption
        raise StorageError("The stored file failed its integrity check and cannot be opened.") from exc


class _LocalBackend:
    name = "local"

    def __init__(self):
        self.root = Path(os.getenv("VAULT_LOCAL_DIR") or _PROJECT_ROOT / "storage" / "vault").resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise StorageError("Invalid storage key.")
        return path

    def put(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)

    def get(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except FileNotFoundError as exc:
            raise StorageError("The file is missing from storage.") from exc

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class _S3Backend:
    """Any S3-compatible service. For Cloudflare R2 set S3_ENDPOINT_URL to
    https://<account-id>.r2.cloudflarestorage.com and S3_REGION=auto."""
    name = "s3"

    def __init__(self):
        import boto3
        from botocore.config import Config

        self.bucket = os.getenv("S3_BUCKET", "").strip()
        if not self.bucket:
            raise StorageError("S3_BUCKET is not set.")
        self.client = boto3.client(
            "s3",
            endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
            aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or None,
            region_name=os.getenv("S3_REGION") or "auto",
            config=Config(retries={"max_attempts": 3, "mode": "standard"}, signature_version="s3v4"),
        )

    def put(self, key: str, data: bytes) -> None:
        try:
            self.client.put_object(Bucket=self.bucket, Key=key, Body=data,
                                   ContentType="application/octet-stream")
        except Exception as exc:
            raise StorageError("Could not save the file to cloud storage.") from exc

    def get(self, key: str) -> bytes:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except self.client.exceptions.NoSuchKey as exc:
            raise StorageError("The file is missing from storage.") from exc
        except Exception as exc:
            raise StorageError("Could not read the file from cloud storage.") from exc

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except Exception as exc:
            raise StorageError("Could not delete the file from cloud storage.") from exc


class VaultStorage:
    def __init__(self):
        self._backend = None
        self._lock = threading.Lock()

    @property
    def backend(self):
        with self._lock:
            if self._backend is None:
                kind = os.getenv("STORAGE_BACKEND", "local").strip().lower()
                if kind == "s3":
                    self._backend = _S3Backend()
                elif kind == "local":
                    self._backend = _LocalBackend()
                else:
                    raise StorageError(f"Unknown STORAGE_BACKEND '{kind}' (use 's3' or 'local').")
            return self._backend

    def reset(self) -> None:
        with self._lock:
            self._backend = None

    def save(self, key: str, plaintext: bytes) -> None:
        self.backend.put(key, encrypt(plaintext, key))

    def load(self, key: str) -> bytes:
        return decrypt(self.backend.get(key), key)

    def remove(self, key: str) -> None:
        self.backend.delete(key)


vault_storage = VaultStorage()
