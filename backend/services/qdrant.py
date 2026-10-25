"""
Qdrant Vector Database Interface
Provides compatibility layer for the application to use Qdrant
"""
import os
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, PayloadSchemaType, SparseVectorParams, Modifier,
)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "LegalDocument")
VECTOR_SIZE = int(os.getenv("QDRANT_VECTOR_SIZE", "1024"))  # Voyage voyage-3.5 dimension

# Payload fields we filter/search on — indexed for fast server-side filtering.
_PAYLOAD_INDEXES = {
    "doc_type": PayloadSchemaType.KEYWORD,
    "court": PayloadSchemaType.KEYWORD,
    "year": PayloadSchemaType.KEYWORD,
    "source_id": PayloadSchemaType.KEYWORD,
    "document_id": PayloadSchemaType.KEYWORD,  # user-uploaded docs
    "status": PayloadSchemaType.KEYWORD,
    "is_chief_justice": PayloadSchemaType.BOOL,
    "judge_name": PayloadSchemaType.TEXT,
}


class QdrantService:
    def __init__(self):
        self.qdrant_client: QdrantClient | None = None

    def get_qdrant_client(self) -> QdrantClient:
        """Returns Qdrant client for vector database operations."""
        if self.qdrant_client is not None:
            try:
                self.qdrant_client.get_collections()
                return self.qdrant_client
            except Exception:
                self.qdrant_client = None

        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        qdrant_api_key = os.getenv("QDRANT_API_KEY", "")

        try:
            if qdrant_api_key:
                self.qdrant_client = QdrantClient(
                    url=qdrant_url,
                    api_key=qdrant_api_key,
                    timeout=60,
                )
            else:
                self.qdrant_client = QdrantClient(
                    url=qdrant_url,
                    timeout=60,
                )

            self.qdrant_client.get_collections()
            print(f"✅ Connected to Qdrant: {qdrant_url}")

            self.ensure_schema(self.qdrant_client)
            return self.qdrant_client

        except Exception as error:
            print(f"✗ Failed to connect to Qdrant: {error}")
            raise

    def close_qdrant_client(self) -> None:
        """Close Qdrant connection."""
        if self.qdrant_client is not None:
            try:
                self.qdrant_client.close()
            except Exception:
                pass
            self.qdrant_client = None

    def ensure_schema(self, client: QdrantClient) -> None:
        """Ensure collection exists with the right vector config AND payload indexes."""
        try:
            collection = client.get_collection(COLLECTION_NAME)
            print(f"✅ Qdrant collection '{COLLECTION_NAME}' exists ({collection.points_count} points)")
        except Exception:
            try:
                print(f"📝 Creating Qdrant collection '{COLLECTION_NAME}' (named dense+sparse, size {VECTOR_SIZE})...")
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config={"dense": VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)},
                    sparse_vectors_config={"sparse": SparseVectorParams(modifier=Modifier.IDF)},
                )
                print(f"✅ Collection '{COLLECTION_NAME}' created successfully")
            except Exception as error:
                print(f"⚠️ Error creating collection: {error}")
                return

        self.ensure_payload_indexes(client)

    def ensure_payload_indexes(self, client: QdrantClient) -> None:
        """Create payload indexes used for filtering. Idempotent — safe to re-run."""
        for field_name, schema in _PAYLOAD_INDEXES.items():
            try:
                client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name=field_name,
                    field_schema=schema,
                )
            except Exception:
                pass

    def migrate_schema(self, client: QdrantClient) -> None:
        """Qdrant doesn't require pre-schema creation like Weaviate."""
        self.ensure_schema(client)


qdrant_service = QdrantService()


def get_qdrant_client() -> QdrantClient:
    return qdrant_service.get_qdrant_client()


def close_qdrant_client() -> None:
    qdrant_service.close_qdrant_client()


def ensure_schema(client: QdrantClient) -> None:
    qdrant_service.ensure_schema(client)


def migrate_schema(client: QdrantClient) -> None:
    qdrant_service.migrate_schema(client)
