"""
Unified ingestion pipeline — the SINGLE source of truth for writing documents
into Qdrant. Every ingestion path (CLI scripts + /ingest API) goes through here
so chunking, the payload schema, and point IDs stay consistent.

  • ONE chunker (chunking_service) with structure-aware, token-sized chunks.
  • ONE canonical payload schema (always includes source_id).
  • Deterministic uuid5 point IDs  → re-running UPSERTS instead of duplicating.
  • Per-source field adapters       → normalizes SC arrays vs ISB/LHC strings, etc.
  • Contextual chunk headers        → each chunk carries its own title/court/year.
"""

import re
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import jsonlines
from qdrant_client.models import (
    PointStruct,
    Filter as QdrantFilter,
    FieldCondition,
    MatchValue,
)

from backend.services.qdrant import qdrant_service, COLLECTION_NAME
from backend.services.embeddings import embeddings_service, EmbeddingQuotaExceeded
from backend.services.sparse import sparse_service
from backend.services.chunking import chunking_service


# ─── doc_type families (substring-based so variants route correctly) ──────────
def is_judge_type(doc_type: str) -> bool:
    return "judge" in doc_type

def is_law_type(doc_type: str) -> bool:
    return doc_type.endswith("_law") or doc_type in ("federal_law", "punjab_law")

def is_case_type(doc_type: str) -> bool:
    return not is_judge_type(doc_type) and not is_law_type(doc_type)


COURT_MAP = {
    "sc_case": "Supreme Court of Pakistan",
    "isb_case": "Islamabad High Court",
    "lhc_case": "Lahore High Court",
    "federal_law": "Federal Legislature",
    "punjab_law": "Punjab Legislature",
    "sc_judge": "Supreme Court of Pakistan",
    "isb_judge": "Islamabad High Court",
    "lhc_judge": "Lahore High Court",
}

_YEAR_RE = re.compile(r"(\d{4})")


# ─── small helpers ──────────────────────────────────────────────────────────

def _first(record: Dict[str, Any], *keys: str) -> str:
    for k in keys:
        v = record.get(k)
        if v not in (None, "", [], {}):
            return str(v).strip() if not isinstance(v, (list, dict)) else v
    return ""


def _join(value: Any, limit: int = 5) -> str:
    if isinstance(value, list):
        parts = [str(v).strip() for v in value if str(v).strip()]
        return ", ".join(parts[:limit])
    return str(value or "").strip()


def _resolve_year(record: Dict[str, Any]) -> str:
    year = str(record.get("year", "") or "").strip()
    if year[:4].isdigit():
        return year[:4]
    for date_field in ("decision_date", "date", "date_of_appointment", "date_of_elevation"):
        raw = record.get(date_field)
        if raw and str(raw).upper() != "N/A":
            m = _YEAR_RE.search(str(raw))
            if m:
                return m.group(1)
    return ""


def _resolve_court(record: Dict[str, Any], doc_type: str) -> str:
    court = str(record.get("court", "") or "").strip()
    if court and court.upper() not in ("", "UNKNOWN", "N/A"):
        return court
    return COURT_MAP.get(doc_type, "Unknown")


def _norm_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    if s in ("sitting", "active", "current", "serving"):
        return "SITTING"
    if s in ("former", "retired", "ex", "past", "inactive"):
        return "FORMER"
    return "UNKNOWN"


# ─── per-family adapters: raw record → canonical metadata ──────────────────────

def _case_metadata(record: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
    title = _first(record, "case_title", "title") or "Untitled"
    source_id = _first(record, "case_number", "case_id", "id") or "unknown"
    return {
        "doc_type": doc_type,
        "source_id": source_id,
        "title": title,
        "case_title": title,
        "case_number": source_id,
        "court": _resolve_court(record, doc_type),
        "year": _resolve_year(record),
        "citation": _first(record, "citation"),
        "decision_date": _first(record, "decision_date", "date"),
        "pdf_url": _first(record, "pdf_url"),
        "judge": _join(record.get("judge") or record.get("judges_list")),
        "petitioner": _join(record.get("petitioner") or record.get("petitioners")),
        "respondent": _join(record.get("respondent") or record.get("respondents")),
        "category": _first(record, "category"),
    }


def _law_metadata(record: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
    title = _first(record, "title", "law_title") or "Untitled"
    # Prefer a UNIQUE key: sr_no (Punjab, unique) or id (Federal slug, unique).
    # law_no is NOT unique (Roman numerals repeat) — using it collapses laws.
    source_id = _first(record, "sr_no", "id", "law_no") or "unknown"
    return {
        "doc_type": doc_type,
        "source_id": source_id,
        "title": title,
        "case_title": title,
        "court": _resolve_court(record, doc_type),
        "year": _resolve_year(record),
        "pdf_url": _first(record, "pdf_url"),
        "category": _first(record, "category"),
        "jurisdiction": _first(record, "jurisdiction"),
        "law_no": _first(record, "law_no"),
    }


def _judge_metadata(record: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
    name = _first(record, "full_name", "name", "judge_name") or "Unknown Judge"
    source_id = _first(record, "judge_id", "id") or name
    designation = _first(record, "designation")
    image_url = _first(record, "profile_photo_url", "image_url")
    is_chief = bool(record.get("is_chief_justice", False)) or "chief justice" in designation.lower()
    return {
        "doc_type": doc_type,
        "source_id": str(source_id),
        "title": name,
        "judge_name": name,
        "court": _resolve_court(record, doc_type),
        "year": _resolve_year(record),
        "designation": designation,
        "status": _norm_status(_first(record, "status")),
        "is_chief_justice": is_chief,
        "image_url": image_url,
        "date_of_appointment": _first(record, "date_of_appointment", "date_of_elevation"),
    }


def canonical_metadata(record: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
    if is_judge_type(doc_type):
        return _judge_metadata(record, doc_type)
    if is_law_type(doc_type):
        return _law_metadata(record, doc_type)
    return _case_metadata(record, doc_type)


# ─── text extraction ──────────────────────────────────────────────────────────

_CASE_TEXT_FIELDS = ("text_content", "content", "judgment_text", "full_text", "text")
_LAW_TEXT_FIELDS = ("full_text", "text_content", "content", "law_text", "text")
_JUDGE_TEXT_FIELDS = ("bio", "biography", "profile_bio", "text_content", "content")


def _extract_body(record: Dict[str, Any], doc_type: str) -> str:
    fields = (
        _JUDGE_TEXT_FIELDS if is_judge_type(doc_type)
        else _LAW_TEXT_FIELDS if is_law_type(doc_type)
        else _CASE_TEXT_FIELDS
    )
    best = ""
    for f in fields:
        v = record.get(f)
        if v and len(str(v)) > len(best):
            best = str(v)
    return best.strip()


def _context_header(meta: Dict[str, Any], doc_type: str) -> str:
    bits = [meta.get("title", "")]
    if meta.get("court"):
        bits.append(meta["court"])
    if meta.get("year"):
        bits.append(str(meta["year"]))
    if meta.get("citation"):
        bits.append(meta["citation"])
    tag = "JUDGE" if is_judge_type(doc_type) else "LAW" if is_law_type(doc_type) else "CASE"
    return f"[{tag}] " + " | ".join(b for b in bits if b)


def _judge_profile_chunk(meta: Dict[str, Any], body: str) -> str:
    parts = [f"JUDGE PROFILE: {meta['judge_name']}"]
    if meta.get("court"):
        parts.append(f"Court: {meta['court']}")
    if meta.get("designation"):
        parts.append(f"Designation: {meta['designation']}")
    if meta.get("status") and meta["status"] != "UNKNOWN":
        parts.append(f"Status: {meta['status']}")
    if meta.get("is_chief_justice"):
        parts.append(f"{meta['judge_name']} is/was Chief Justice of {meta.get('court', '')}.")
    if meta.get("date_of_appointment"):
        parts.append(f"Appointed/Elevated: {meta['date_of_appointment']}")
    if body:
        parts.append(f"Biography: {body[:400]}")
    return "\n".join(parts)


# ─── chunk builder ──────────────────────────────────────────────────────────

def build_chunks(record: Dict[str, Any], doc_type: str) -> List[Dict[str, Any]]:
    meta = canonical_metadata(record, doc_type)
    body = _extract_body(record, doc_type)
    is_judge = is_judge_type(doc_type)

    if not body and not is_judge:
        return []

    splitter = chunking_service.get_text_splitter()
    texts: List[str] = []
    if is_judge:
        texts.append(_judge_profile_chunk(meta, body))
        if body:
            for piece in splitter.split_text(body):
                piece = piece.strip()
                if len(piece) >= 50:
                    texts.append(piece)
    else:
        header = _context_header(meta, doc_type)
        for piece in splitter.split_text(body):
            piece = piece.strip()
            if len(piece) >= 50:
                texts.append(f"{header}\n\n{piece}")

    total = len(texts)
    chunks: List[Dict[str, Any]] = []
    for i, text in enumerate(texts):
        chunks.append({**meta, "content": text, "chunk_index": i, "total_chunks": total})
    return chunks


# ─── ingestion service ──────────────────────────────────────────────────────

class IngestionService:
    def delete_doc_type(self, doc_type: str) -> None:
        client = qdrant_service.get_qdrant_client()
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=QdrantFilter(
                must=[FieldCondition(key="doc_type", match=MatchValue(value=doc_type))]
            ),
            wait=True,
        )

    def _point_id(self, doc_type: str, source_id: str, chunk_index: int) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_type}:{source_id}:{chunk_index}"))

    def _filter_existing(self, client, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ids = [self._point_id(c["doc_type"], c["source_id"], c["chunk_index"]) for c in chunks]
        existing = set()
        for i in range(0, len(ids), 256):
            got = client.retrieve(
                collection_name=COLLECTION_NAME,
                ids=ids[i:i + 256],
                with_payload=False,
                with_vectors=False,
            )
            existing.update(str(p.id) for p in got)
        return [c for c, pid in zip(chunks, ids) if pid not in existing]

    def _upsert(self, client, chunks: List[Dict[str, Any]], skip_existing: bool = False) -> int:
        if skip_existing:
            chunks = self._filter_existing(client, chunks)
        if not chunks:
            return 0
        texts = [c["content"] for c in chunks]
        dense_vectors = embeddings_service.embed_texts(texts)
        sparse_vectors = sparse_service.embed_documents(texts)
        points = []
        for chunk, dvec, svec in zip(chunks, dense_vectors, sparse_vectors):
            payload = {k: v for k, v in chunk.items() if v not in (None, "")}
            pid = self._point_id(chunk["doc_type"], chunk["source_id"], chunk["chunk_index"])
            points.append(PointStruct(id=pid, vector={"dense": dvec, "sparse": svec}, payload=payload))
        client.upsert(collection_name=COLLECTION_NAME, points=points, wait=False)
        return len(points)

    def ingest_file(
        self,
        file_path: str,
        doc_type: str,
        batch_size: int = 64,
        clean: bool = False,
        skip_existing: bool = False,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
        total_records: int = 0,
    ) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        client = qdrant_service.get_qdrant_client()
        if clean:
            print(f"🧹 Clearing existing '{doc_type}' points before re-ingest...")
            self.delete_doc_type(doc_type)

        docs = chunks_stored = errors = 0
        pending: List[Dict[str, Any]] = []
        quota_hit = False

        print(f"📂 Ingesting {file_path} as doc_type='{doc_type}'...")
        try:
            with jsonlines.open(file_path) as reader:
                for record in reader:
                    try:
                        record_chunks = build_chunks(record, doc_type)
                    except Exception as exc:
                        errors += 1
                        print(f"  ⚠️ Error on record: {exc}")
                        continue
                    if not record_chunks:
                        continue
                    pending.extend(record_chunks)
                    docs += 1
                    if progress_callback and total_records:
                        progress_callback(docs, total_records, "Ingesting")
                    while len(pending) >= batch_size:
                        chunks_stored += self._upsert(client, pending[:batch_size], skip_existing)
                        pending = pending[batch_size:]
            if pending:
                chunks_stored += self._upsert(client, pending, skip_existing)
        except EmbeddingQuotaExceeded as exc:
            quota_hit = True
            print(f"\n🟡 Embedding quota/rate limit reached for '{doc_type}': {exc}")
            print("   Progress saved. Re-run WITHOUT --recreate later to resume (skips done chunks).")

        result = {
            "message": f"Ingestion {'INCOMPLETE (quota)' if quota_hit else 'complete'} for {doc_type}",
            "documents_processed": docs,
            "chunks_stored": chunks_stored,
            "errors": errors,
            "doc_type": doc_type,
            "quota_hit": quota_hit,
        }
        status = "🟡 partial" if quota_hit else "✅"
        print(f"{status} {doc_type}: {docs} docs → {chunks_stored} new chunks ({errors} errors)")
        return result


ingestion_service = IngestionService()


def ingest_jsonl_file(
    file_path: str,
    doc_type: str,
    batch_size: int = 64,
    clean: bool = False,
    skip_existing: bool = False,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
    total_records: int = 0,
) -> Dict[str, Any]:
    return ingestion_service.ingest_file(
        file_path=file_path,
        doc_type=doc_type,
        batch_size=batch_size,
        clean=clean,
        skip_existing=skip_existing,
        progress_callback=progress_callback,
        total_records=total_records,
    )
