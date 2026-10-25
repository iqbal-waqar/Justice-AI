"""
Migrate LegalDocument_v2 (dense only) → LegalDocument_v3 (named dense + sparse BM25).

Reuses the existing Voyage dense vectors (no re-embedding) and adds a BM25 sparse
vector per chunk so Qdrant can run TRUE full-corpus hybrid search natively.

    python migrate_to_v3.py            # build v3 from v2
    python migrate_to_v3.py --validate # just compare counts
"""
import argparse
import os
import warnings
warnings.filterwarnings("ignore")

from dotenv import load_dotenv
load_dotenv()

from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, SparseVectorParams, Modifier, PointStruct, PayloadSchemaType,
)
from backend.services.sparse import sparse_service

SRC = "LegalDocument_v2"
DST = "LegalDocument_v3"
VECTOR_SIZE = 1024
BATCH = 256

INDEXES = {
    "doc_type": PayloadSchemaType.KEYWORD,
    "court": PayloadSchemaType.KEYWORD,
    "year": PayloadSchemaType.KEYWORD,
    "source_id": PayloadSchemaType.KEYWORD,
    "document_id": PayloadSchemaType.KEYWORD,
    "status": PayloadSchemaType.KEYWORD,
    "is_chief_justice": PayloadSchemaType.BOOL,
    "judge_name": PayloadSchemaType.TEXT,
}


def client():
    return QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"), timeout=120)


def create_v3(c):
    print(f"♻️  Creating {DST} (named dense+sparse)...")
    try:
        c.delete_collection(DST)
    except Exception:
        pass
    c.create_collection(
        collection_name=DST,
        vectors_config={"dense": VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)},
        sparse_vectors_config={"sparse": SparseVectorParams(modifier=Modifier.IDF)},
    )
    for field, schema in INDEXES.items():
        try:
            c.create_payload_index(DST, field, schema)
        except Exception:
            pass
    print("✅ Collection + indexes ready.")


def migrate(c):
    total = c.get_collection(SRC).points_count or 0
    print(f"📦 Migrating {total:,} points {SRC} → {DST} (reusing dense, adding sparse)...")
    off = None
    done = 0
    while True:
        pts, off = c.scroll(SRC, limit=BATCH, offset=off, with_payload=True, with_vectors=True)
        if not pts:
            break
        contents = [((p.payload or {}).get("content", "") or " ") for p in pts]
        svecs = sparse_service.embed_documents(contents)
        points = []
        for p, sv in zip(pts, svecs):
            dense = p.vector  # v2 is single unnamed vector → a list
            if isinstance(dense, dict):  # already named (safety)
                dense = dense.get("dense")
            points.append(PointStruct(id=p.id, vector={"dense": dense, "sparse": sv}, payload=p.payload))
        c.upsert(DST, points=points, wait=False)
        done += len(points)
        print(f"\r   {done:,}/{total:,}", end="", flush=True)
        if off is None:
            break
    print(f"\n✅ Migrated {done:,} points.")


def validate(c):
    s = c.get_collection(SRC).points_count
    d = c.get_collection(DST).points_count
    print(f"\nVALIDATION: {SRC}={s:,}  {DST}={d:,}  {'✅ MATCH' if s == d else '❌ MISMATCH'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--validate", action="store_true")
    args = ap.parse_args()
    c = client()
    if args.validate:
        validate(c)
    else:
        create_v3(c)
        migrate(c)
        validate(c)
