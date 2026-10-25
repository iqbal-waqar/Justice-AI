"""
Master re-ingestion orchestrator for Wakeels AI (Voyage AI / 1024-dim).

Re-ingests ALL source corpora into the configured Qdrant collection through the
unified ingestion pipeline (backend.services.ingestion), with standardized,
retrieval-aligned doc_types.

Blue-green usage (recommended, zero downtime):
    1. Point QDRANT_COLLECTION_NAME at a NEW collection, e.g. LegalDocument_v2
    2. python run_reingest.py --recreate          # build v2 fresh
    3. Validate the printed per-doc_type counts
    4. (QDRANT_COLLECTION_NAME is already v2 → app uses it); delete the old collection

Options:
    --recreate            Drop & recreate the target collection (fresh 1024-dim).
    --only <doc_type>     Ingest just one doc_type.
    --batch-size <n>      Embedding/upsert batch size (default 64).
"""

import argparse
import os
import warnings

warnings.filterwarnings("ignore")

from dotenv import load_dotenv
load_dotenv()

from qdrant_client.models import VectorParams, Distance
from backend.services.qdrant import qdrant_service, COLLECTION_NAME, VECTOR_SIZE
from backend.services.ingestion import ingestion_service

# doc_type → source JSONL  (standardized names; smallest/high-value first)
SOURCES = [
    ("sc_judge",    "data/sc_data/sc_judges_clean.jsonl"),
    ("isb_judge",   "data/isb_data/isb_judges_rebuilt.jsonl"),
    ("lhc_judge",   "data/lhc_data/lhc_judges_rebuilt.jsonl"),
    ("federal_law", "data/federal_laws/federal_laws_index.jsonl"),
    ("punjab_law",  "data/punjab_province_laws/punjab_laws_index.jsonl"),
    ("isb_case",    "data/isb_data/isb_cases_rebuilt.jsonl"),
    ("sc_case",     "data/sc_data/sc_cases_rebuilt.jsonl"),
    ("lhc_case",    "data/lhc_data/lhc_cases_rebuilt.jsonl"),
]


def recreate_collection():
    client = qdrant_service.get_qdrant_client()
    print(f"♻️  Recreating collection '{COLLECTION_NAME}' ({VECTOR_SIZE}-dim, cosine)...")
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )
    qdrant_service.ensure_payload_indexes(client)
    print("✅ Collection recreated with payload indexes.")


def validate():
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    client = qdrant_service.get_qdrant_client()
    info = client.get_collection(COLLECTION_NAME)
    print("\n" + "=" * 52)
    print(f"VALIDATION — collection '{COLLECTION_NAME}'")
    print(f"TOTAL points: {info.points_count:,}")
    print("-" * 52)
    total = 0
    for doc_type, _ in SOURCES:
        c = client.count(
            collection_name=COLLECTION_NAME,
            count_filter=Filter(must=[FieldCondition(key="doc_type", match=MatchValue(value=doc_type))]),
            exact=True,
        ).count
        total += c
        flag = "" if c > 0 else "  ⚠️ EMPTY"
        print(f"  {doc_type:<14} {c:>9,}{flag}")
    print("-" * 52)
    print(f"  {'SUM':<14} {total:>9,}")
    print("=" * 52)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recreate", action="store_true", help="Drop & recreate the collection first")
    ap.add_argument("--only", default=None, help="Ingest only this doc_type")
    ap.add_argument("--batch-size", type=int, default=64)
    args = ap.parse_args()

    print(f"🎯 Target collection: {COLLECTION_NAME}  |  vector size: {VECTOR_SIZE}")
    print(f"🧠 Embedding: Voyage AI / {os.getenv('VOYAGE_MODEL', 'voyage-3.5')}")

    if args.recreate:
        recreate_collection()
    else:
        qdrant_service.get_qdrant_client()

    sources = [s for s in SOURCES if (args.only is None or s[0] == args.only)]
    if not sources:
        print(f"❌ No source matched --only={args.only}. Known: {[s[0] for s in SOURCES]}")
        return

    skip_existing = not args.recreate  # resume mode when continuing an existing collection

    quota_hit = False
    for doc_type, path in sources:
        if not os.path.exists(path):
            print(f"⏭️  Skipping {doc_type}: source not found ({path})")
            continue
        total_records = sum(1 for _ in open(path, "r", encoding="utf-8"))
        res = ingestion_service.ingest_file(
            file_path=path,
            doc_type=doc_type,
            batch_size=args.batch_size,
            clean=False,
            skip_existing=skip_existing,
            total_records=total_records,
        )
        if res.get("quota_hit"):
            quota_hit = True
            break

    validate()

    if quota_hit:
        print("\n🟡 Rate/quota limit hit — ingest INCOMPLETE. Resume with: python run_reingest.py")
    else:
        print("\n✅ All sources ingested. Collection is complete.")


if __name__ == "__main__":
    main()
