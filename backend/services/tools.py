import os
import re
import requests
import numpy as np
from typing import Optional, List, Dict, Any
from langchain.tools import tool
from sentence_transformers import CrossEncoder
from rank_bm25 import BM25Okapi

from backend.services.qdrant import qdrant_service, COLLECTION_NAME
from backend.services.embeddings import embeddings_service
from backend.services.sparse import sparse_service
from backend.services.query_rewriter import query_rewriter_service

# ─── Hybrid search weight configuration (tunable via .env) ────────────────────
DENSE_WEIGHT = float(os.getenv("HYBRID_DENSE_WEIGHT", "0.6"))
BM25_WEIGHT = float(os.getenv("HYBRID_BM25_WEIGHT", "0.4"))
RRF_K = int(os.getenv("HYBRID_RRF_K", "60"))

# ─── Singleton reranker ────────────────────────────────────────────────────────
_reranker: Optional[CrossEncoder] = None


def _get_reranker() -> CrossEncoder:
    global _reranker
    if _reranker is None:
        # L-6-v2: 6-layer model — 2× faster than L-12-v2 with minimal quality loss.
        # Best tradeoff for production CPU inference.
        _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-12-v2", max_length=512, device="cpu")
    return _reranker


# ─── Core retrieval helpers ────────────────────────────────────────────────────

def _build_qdrant_filter(doc_type_filter: Optional[Any] = None, court_filter: Optional[str] = None, year_filter: Optional[str] = None) -> Optional[Any]:
    """Build a Qdrant filter from provided criteria."""
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue, HasIdCondition, Range
    
    conditions = []
    if doc_type_filter:
        if isinstance(doc_type_filter, str):
            conditions.append(FieldCondition(key="doc_type", match=MatchValue(value=doc_type_filter)))
        elif isinstance(doc_type_filter, list):
            # For multiple values, create OR-like condition using multiple FieldConditions
            # Qdrant doesn't have direct OR for same field, so we return None and let caller handle
            return None  # Caller will do separate searches
    if court_filter:
        conditions.append(FieldCondition(key="court", match=MatchValue(value=court_filter)))
    if year_filter:
        conditions.append(FieldCondition(key="year", match=MatchValue(value=str(year_filter))))
    
    if not conditions:
        return None
    if len(conditions) == 1:
        return QdrantFilter(must=conditions)
    return QdrantFilter(must=conditions)


def _qfilter(doc_type_filter: Optional[Any] = None, court_filter: Optional[str] = None, year_filter: Optional[str] = None):
    """Build a server-side Qdrant filter (handles str or list doc_type)."""
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue, MatchAny
    must = []
    if doc_type_filter:
        if isinstance(doc_type_filter, list):
            must.append(FieldCondition(key="doc_type", match=MatchAny(any=doc_type_filter)))
        else:
            must.append(FieldCondition(key="doc_type", match=MatchValue(value=doc_type_filter)))
    if court_filter:
        must.append(FieldCondition(key="court", match=MatchValue(value=court_filter)))
    if year_filter:
        must.append(FieldCondition(key="year", match=MatchValue(value=str(year_filter))))
    return QdrantFilter(must=must) if must else None


def _map_point(scored_point) -> Dict[str, Any]:
    """Map a Qdrant point/payload to the pipeline's doc dict format."""
    payload = scored_point.payload or {}
    doc_type = payload.get("doc_type", "")
    case_title = payload.get("case_title", "") or payload.get("title", "")
    case_number = payload.get("case_number", "")
    judge_str = payload.get("judge", "")
    judges_list = payload.get("judges_list", [])
    if not judge_str and judges_list:
        judge_str = ", ".join(judges_list[:3])
    return {
        "content": payload.get("content", ""),
        "metadata": {
            "doc_type": doc_type,
            "title": case_title or case_number,
            "case_title": case_title,
            "case_number": case_number,
            "court": payload.get("court", ""),
            "year": payload.get("year", ""),
            "pdf_url": payload.get("pdf_url", ""),
            "image_url": payload.get("image_url", ""),
            "source_id": payload.get("source_id", "") or case_number,
            "chunk_index": payload.get("chunk_index", 0),
            "total_chunks": payload.get("total_chunks", 0),
            "judge": judge_str,
            "decision_date": payload.get("decision_date", ""),
            "citation": payload.get("citation", ""),
            "petitioner": payload.get("petitioner", "") or ", ".join(payload.get("petitioners", [])),
            "respondent": payload.get("respondent", "") or ", ".join(payload.get("respondents", [])),
            "status": payload.get("status", ""),
            "is_chief_justice": payload.get("is_chief_justice", False),
            "judge_name": payload.get("judge_name", ""),
            "designation": payload.get("designation", ""),
        },
        "score": getattr(scored_point, "score", 0.0),
    }


def _qdrant_vector_search(
    query_vector: List[float],
    top_k: int = 20,
    doc_type_filter: Optional[Any] = None,
    court_filter: Optional[str] = None,
    year_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Dense (semantic) search against the named 'dense' vector, server-side filters."""
    client = qdrant_service.get_qdrant_client()
    qfilter = _qfilter(doc_type_filter, court_filter, year_filter)
    try:
        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            using="dense",
            query_filter=qfilter,
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        )
        points = response.points if hasattr(response, "points") else response
    except Exception as e:
        print(f"Qdrant dense search error: {e}")
        return []
    return [_map_point(p) for p in points][:top_k]


def _bm25_search(
    query: str,
    top_k: int = 15,
    doc_type_filter: Optional[Any] = None,
    court_filter: Optional[str] = None,
    year_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Keyword search against Qdrant using SERVER-SIDE filters for speed.

    Previously scrolled up to 5,000 unfiltered points then filtered client-side.
    With 61k+ points in the collection, the relevant doc_type subset (e.g.
    isb_judge) was often past the 5,000 cutoff and returned zero results.
    Now we push doc_type/court/year filters into the Qdrant scroll call so
    we only fetch and score the relevant subset.
    """
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue
    client = qdrant_service.get_qdrant_client()

    # Handle list of doc_types — recurse once per type then merge
    if isinstance(doc_type_filter, list):
        all_results = []
        for dt in doc_type_filter:
            results = _bm25_search(
                query, top_k=top_k,
                doc_type_filter=dt,
                court_filter=court_filter,
                year_filter=year_filter,
            )
            all_results.extend(results)
        seen: Dict[tuple, float] = {}
        deduped: List[Dict] = []
        for r in all_results:
            key = (r["metadata"].get("source_id"), r["metadata"].get("chunk_index"))
            score = r.get("score", 0.0)
            if key not in seen:
                seen[key] = score
                deduped.append(r)
            elif score > seen[key]:
                seen[key] = score
                for i, ex in enumerate(deduped):
                    if (ex["metadata"].get("source_id"), ex["metadata"].get("chunk_index")) == key:
                        deduped[i] = r
                        break
        deduped.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        return deduped[:top_k]

    try:
        query_lower = query.lower()
        # Include 3-char terms (fir, 302, 561, ihc, lhc, etc.) — legal terms are short
        keywords = [w for w in query_lower.split() if len(w) >= 3]
        if not keywords:
            return []

        # ── Build SERVER-SIDE filter so Qdrant only returns the relevant subset ──
        # This avoids scanning all 61k points and guarantees we reach the right
        # doc_type regardless of its storage offset in the collection.
        scroll_conditions = []
        if doc_type_filter and isinstance(doc_type_filter, str):
            scroll_conditions.append(
                FieldCondition(key="doc_type", match=MatchValue(value=doc_type_filter))
            )
        if court_filter:
            scroll_conditions.append(
                FieldCondition(key="court", match=MatchValue(value=court_filter))
            )
        if year_filter:
            scroll_conditions.append(
                FieldCondition(key="year", match=MatchValue(value=str(year_filter)))
            )
        qdrant_filter = QdrantFilter(must=scroll_conditions) if scroll_conditions else None

        # ── Dynamic BM25 cap based on doc type ──
        # Judge types: 400-600 total chunks — 800 is more than enough.
        # Case types: 10k-20k total chunks — cap at 1500 to keep batch calls low
        # Vector search already gives us great semantic coverage.
        _JUDGE_TYPES = {"isb_judge", "sc_judge", "lhc_judge", "lhc_judge_new"}
        _is_judge_type = isinstance(doc_type_filter, str) and doc_type_filter in _JUDGE_TYPES
        _MAX_BM25_DOCS = 600 if _is_judge_type else 500

        all_points: list = []
        _scroll_offset = None
        while len(all_points) < _MAX_BM25_DOCS:
            _batch, _scroll_offset = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=qdrant_filter,
                limit=500,
                offset=_scroll_offset,
                with_payload=True,
                with_vectors=False,
            )
            all_points.extend(_batch)
            if _scroll_offset is None:
                break

        # ── Build searchable text for BM25Okapi TF-IDF scoring ──
        doc_contents = []
        doc_points = []
        for point in all_points:
            payload = point.payload or {}
            doc_type = payload.get("doc_type", "")
            if doc_type in _JUDGE_TYPES:
                text = (
                    payload.get("judge_name", "") + " "
                    + payload.get("designation", "") + " "
                    + payload.get("content", "") + " "
                    + payload.get("court", "")
                ).lower()
            else:
                text = (
                    payload.get("content", "") + " "
                    + payload.get("case_title", "") + " "
                    + payload.get("title", "") + " "
                    + payload.get("case_number", "") + " "
                    + payload.get("petitioner", "") + " "
                    + payload.get("respondent", "")
                ).lower()
            doc_contents.append(text)
            doc_points.append((point, payload))

        if not doc_contents:
            return []

        # ── BM25Okapi TF-IDF scoring (proper term frequency / inverse doc freq) ──
        tokenized_corpus = [text.split() for text in doc_contents]
        bm25 = BM25Okapi(tokenized_corpus)
        bm25_scores = bm25.get_scores(keywords)

        # Normalize scores to [0, 1] for consistent downstream handling
        max_score = float(max(bm25_scores)) if len(bm25_scores) > 0 and max(bm25_scores) > 0 else 1.0

        # Pair scores with points, filter zero-score docs
        scored = []
        for idx, score in enumerate(bm25_scores):
            if score > 0:
                point, payload = doc_points[idx]
                scored.append((point, float(score), payload))

        scored.sort(key=lambda x: x[1], reverse=True)

        results = []
        for point, bm25_score, payload in scored[:top_k]:
            doc_type = payload.get("doc_type", "")
            case_title = payload.get("case_title", "") or payload.get("title", "")
            case_number = payload.get("case_number", "")

            judge_str = payload.get("judge", "")
            judges_list = payload.get("judges_list", [])
            if not judge_str and judges_list:
                judge_str = ", ".join(judges_list[:3])

            results.append({
                "content": payload.get("content", ""),
                "metadata": {
                    "doc_type": doc_type,
                    "title": case_title or case_number,
                    "case_title": case_title,
                    "case_number": case_number,
                    "court": payload.get("court", ""),
                    "year": payload.get("year", ""),
                    "pdf_url": payload.get("pdf_url", ""),
                    "image_url": payload.get("image_url", ""),
                    "source_id": case_number,
                    "chunk_index": payload.get("chunk_index", 0),
                    "total_chunks": payload.get("total_chunks", 0),
                    "judge": judge_str,
                    "decision_date": payload.get("decision_date", ""),
                    "citation": payload.get("citation", ""),
                    "petitioner": payload.get("petitioner", "") or ", ".join(payload.get("petitioners", [])),
                    "respondent": payload.get("respondent", "") or ", ".join(payload.get("respondents", [])),
                    # Judge fields
                    "status": payload.get("status", ""),
                    "is_chief_justice": payload.get("is_chief_justice", False),
                    "judge_name": payload.get("judge_name", ""),
                    "designation": payload.get("designation", ""),
                },
                "score": bm25_score / max_score,  # Normalized BM25Okapi score
            })
        return results

    except Exception as e:
        print(f"Qdrant BM25 search error: {e}")
        return []


def _reciprocal_rank_fusion(
    result_lists: List[List[Dict]],
    weights: Optional[List[float]] = None,
    k: int = None,
) -> List[Dict]:
    """Merge multiple ranked result lists using Weighted Reciprocal Rank Fusion.

    Each list gets a weight (default: [DENSE_WEIGHT, BM25_WEIGHT] from .env).
    Score per doc = sum of weight_i * 1/(k + rank_i) across all lists.
    Documents found in BOTH lists naturally get boosted.

    Args:
        result_lists: ordered list of result sets (e.g. [vector_results, bm25_results])
        weights: per-list weight (e.g. [0.6, 0.4]). Falls back to env config.
        k: RRF constant. Higher = more equal weighting between ranks. Falls back to env.
    """
    if k is None:
        k = RRF_K
    if weights is None:
        weights = [DENSE_WEIGHT, BM25_WEIGHT]
    # Pad weights if more lists than weights provided
    while len(weights) < len(result_lists):
        weights.append(1.0)

    fused: Dict[str, Dict] = {}
    for list_idx, result_list in enumerate(result_lists):
        w = weights[list_idx]
        for rank, doc in enumerate(result_list):
            m = doc.get("metadata", {})
            key = f"{m.get('source_id', '')}|{m.get('chunk_index', 0)}"
            if key not in fused:
                fused[key] = {"doc": doc, "rrf_score": 0.0}
            elif doc.get("score", 0) > fused[key]["doc"].get("score", 0):
                fused[key]["doc"] = doc  # keep doc with better original score
            fused[key]["rrf_score"] += w * (1.0 / (k + rank + 1))

    sorted_results = sorted(fused.values(), key=lambda x: x["rrf_score"], reverse=True)
    # Set score to RRF score for downstream (MMR, reranker input ordering)
    results = []
    for item in sorted_results:
        doc = item["doc"]
        doc["score"] = item["rrf_score"]
        results.append(doc)
    return results


def _hybrid_search(
    query: str,
    top_k: int = 25,
    doc_type_filter: Optional[Any] = None,
    court_filter: Optional[str] = None,
    year_filter: Optional[str] = None,
) -> List[Dict]:
    """True hybrid search via Qdrant's native Query API.

    Runs dense (Voyage) + sparse (BM25) search over the FULL corpus server-side
    and fuses them with Reciprocal Rank Fusion in a single request — no per-query
    scroll or in-Python BM25 rebuild. Returns top-K for downstream MMR + rerank.
    """
    from qdrant_client.models import Prefetch, FusionQuery, Fusion

    client = qdrant_service.get_qdrant_client()
    qfilter = _qfilter(doc_type_filter, court_filter, year_filter)

    try:
        dense_vec = embeddings_service.embed_query(query)
        sparse_vec = sparse_service.embed_query(query)
    except Exception as e:
        print(f"Hybrid embed error: {e}")
        return []

    try:
        response = client.query_points(
            collection_name=COLLECTION_NAME,
            prefetch=[
                Prefetch(query=dense_vec, using="dense", filter=qfilter, limit=top_k * 2),
                Prefetch(query=sparse_vec, using="sparse", filter=qfilter, limit=top_k * 2),
            ],
            query=FusionQuery(fusion=Fusion.RRF),
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        )
        points = response.points if hasattr(response, "points") else response
    except Exception as e:
        print(f"Hybrid query error: {e} — falling back to dense-only")
        return _qdrant_vector_search(dense_vec, top_k, doc_type_filter, court_filter, year_filter)

    return [_map_point(p) for p in points][:top_k]


def _is_complex_query_text(query: str) -> bool:
    q = (query or "").strip().lower()
    if not q:
        return False
    if len(q.split()) >= 45:
        return True
    markers = [" and ", " also ", " additionally ", ";", ":", "?", "explain", "include", "roadmap", "strategy"]
    marker_hits = sum(1 for m in markers if m in q)
    return marker_hits >= 3


def _mmr(candidates: List[Dict], top_k: int = 10, lambda_mult: float = 0.5) -> List[Dict]:
    """MMR diversity filter."""
    if len(candidates) <= top_k:
        return candidates

    scores = [c.get("score", 0.0) for c in candidates]

    def word_set(t: str):
        return set(t.lower().split())

    selected, remaining = [], list(range(len(candidates)))
    best = int(np.argmax(scores))
    selected.append(best)
    remaining.remove(best)

    while len(selected) < top_k and remaining:
        sel_words = [word_set(candidates[i]["content"]) for i in selected]
        mmr_scores = []
        for idx in remaining:
            rel = scores[idx]
            cw = word_set(candidates[idx]["content"])
            max_red = max(
                len(cw & sw) / len(cw | sw) if (cw | sw) else 0
                for sw in sel_words
            )
            mmr_scores.append((idx, lambda_mult * rel - (1 - lambda_mult) * max_red))
        best = max(mmr_scores, key=lambda x: x[1])[0]
        selected.append(best)
        remaining.remove(best)

    return [candidates[i] for i in selected]


# Minimum rerank score — stricter floor to reduce weak matches.
RERANK_FLOOR = 0.0

def _voyage_rerank(query: str, candidates: List[Dict]) -> Optional[List[Dict]]:
    """Rerank via Voyage's hosted rerank API (fast, no CPU). Returns None on failure."""
    key = os.getenv("VOYAGE_API_KEY", "").strip()
    if not key:
        return None
    docs = [d.get("content", "") or " " for d in candidates]
    try:
        resp = requests.post(
            "https://api.voyageai.com/v1/rerank",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "query": query,
                "documents": docs,
                "model": os.getenv("VOYAGE_RERANK_MODEL", "rerank-2.5-lite"),
                "truncation": True,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"[rerank] Voyage HTTP {resp.status_code}: {resp.text[:120]}")
            return None
        ranked: List[Dict] = []
        for item in resp.json()["data"]:  # already sorted by relevance desc
            d = candidates[item["index"]]
            score = float(item["relevance_score"])
            d["rerank_score"] = score
            d["metadata"]["rerank_score"] = score
            ranked.append(d)
        return ranked
    except Exception as e:
        print(f"[rerank] Voyage error: {e}")
        return None


def _cross_encoder_rerank(query: str, candidates: List[Dict]) -> List[Dict]:
    """Local CPU cross-encoder reranking (fallback)."""
    reranker = _get_reranker()
    scores = reranker.predict([(query, d["content"]) for d in candidates])
    for d, s in zip(candidates, scores):
        d["rerank_score"] = float(s)
        d["metadata"]["rerank_score"] = float(s)
    return sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)


def _rerank(query: str, candidates: List[Dict], top_k: int = 5) -> List[Dict]:
    """Rerank (Voyage hosted → cross-encoder fallback) with dedup + floor filtering."""
    if not candidates:
        return []
    ranked = _voyage_rerank(query, candidates)
    if ranked is None:
        ranked = _cross_encoder_rerank(query, candidates)

    # Deduplicate: keep only the highest-scoring chunk per case title
    seen_titles: set = set()
    deduped: List[Dict] = []
    for d in ranked:
        title = d.get("metadata", {}).get("title", "").strip().lower()
        if title and title in seen_titles:
            continue
        seen_titles.add(title)
        deduped.append(d)

    deduped = deduped[:top_k]
    # Filter out results below the relevance floor
    filtered = [d for d in deduped if d["rerank_score"] >= RERANK_FLOOR]
    return filtered if filtered else deduped[:1]  # always return at least 1

RERANK_WARN = 0.3


def _expand_chunk_context(docs: List[Dict], max_docs: int = 2) -> Dict[str, Dict[str, str]]:
    """Fetch header chunks (0-1) AND surrounding chunks for each matched case.

    For each case judgment:
      - Chunks 0-1: title, citation, judge names, parties, advocates, date
      - Chunks N-1 through N+2: extended context around the matched passage

    max_docs: only expand the top-N docs to keep Qdrant round-trips low (2 docs × 2 calls = 4 Qdrant calls).
    Returns: {source_id: {"header": header_text, "surrounding": surrounding_text}}
    """
    docs = docs[:max_docs]  # Limit to top-N to cut extra Qdrant calls
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue, Range
    
    # Collect source_ids and their matched chunk indices
    source_info: Dict[str, List[int]] = {}
    for d in docs:
        m = d.get("metadata", {})
        sid = m.get("source_id", "")
        ci = m.get("chunk_index", 0)
        dt = m.get("doc_type", "")
        if sid and "judge" not in dt:
            if sid not in source_info:
                source_info[sid] = []
            source_info[sid].append(ci)

    if not source_info:
        return {}

    result: Dict[str, Dict[str, str]] = {}
    try:
        client = qdrant_service.get_qdrant_client()

        for sid, matched_indices in source_info.items():
            try:
                # --- Query 1: Fetch header chunks (0-1) ---
                header_filter = QdrantFilter(must=[
                    FieldCondition(key="source_id", match=MatchValue(value=sid)),
                    FieldCondition(key="chunk_index", range=Range(gte=0, lte=1))
                ])
                
                header_points, _ = client.scroll(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=header_filter,
                    limit=2,
                    with_payload=True,
                    with_vectors=False,
                )
                
                header_parts = []
                for point in sorted(header_points, key=lambda p: p.payload.get("chunk_index", 0) if p.payload else 0):
                    if point.payload:
                        header_parts.append(point.payload.get("content", ""))

                # --- Query 2: Fetch surrounding chunks for matched passages ---
                surround_indices = set()
                for ci in matched_indices:
                    for offset in range(-1, 3):  # N-1, N, N+1, N+2
                        idx = max(0, ci + offset)
                        if idx > 1:  # skip header chunks, already fetched
                            surround_indices.add(idx)

                surrounding_parts = []
                if surround_indices:
                    min_ci = min(surround_indices)
                    max_ci = max(surround_indices)
                    
                    surround_filter = QdrantFilter(must=[
                        FieldCondition(key="source_id", match=MatchValue(value=sid)),
                        FieldCondition(key="chunk_index", range=Range(gte=min_ci, lte=max_ci))
                    ])
                    
                    surround_points, _ = client.scroll(
                        collection_name=COLLECTION_NAME,
                        scroll_filter=surround_filter,
                        limit=max_ci - min_ci + 5,
                        with_payload=True,
                        with_vectors=False,
                    )
                    
                    for point in sorted(surround_points, key=lambda p: p.payload.get("chunk_index", 0) if p.payload else 0):
                        if point.payload:
                            ci_fetched = point.payload.get("chunk_index", 0)
                            if ci_fetched in surround_indices:
                                surrounding_parts.append(point.payload.get("content", ""))

                result[sid] = {
                    "header": "\n".join(header_parts),
                    "surrounding": "\n".join(surrounding_parts),
                }
            except Exception:
                continue
    except Exception:
        pass

    return result


def _format_results(docs: List[Dict]) -> str:
    """Format retrieved docs for the agent."""
    if not docs:
        return "NO MATCHING DATA — no relevant documents found for this query."

    lines = []
    n = len(docs)
    best_score = max(d.get("rerank_score", d.get("score", 0)) for d in docs)

    # NO more _expand_chunk_context — it added 4+ Qdrant network calls (8-16s).
    # The matched chunk content (3000+ chars) is sufficient for synthesis.

    for i, d in enumerate(docs, 1):
        m = d.get("metadata", {})
        score = d.get("rerank_score", d.get("score", 0))
        doc_type = m.get("doc_type", "")

        # ── Special formatting for JUDGE PROFILES ──
        if doc_type in ("isb_judge", "lhc_judge_new", "lhc_judge", "sc_judge"):
            judge_name = m.get("judge_name") or m.get("title", "Unknown Judge")
            designation = m.get("designation", "").strip()
            court = m.get("court", "").strip()
            status = m.get("status", "").strip()
            is_chief = m.get("is_chief_justice", False)
            doa = m.get("date_of_appointment", "").strip()
            image_url = m.get("image_url", "").strip()
            bio = d.get("content", "").strip()

            bio_lower = bio.lower()
            title_lower = judge_name.lower()
            desig_lower = designation.lower()
            is_cj = (
                is_chief
                or 'chief justice' in desig_lower
                or 'chief justice' in title_lower
                or 'chief justice of pakistan' in bio_lower
                or 'chief justice of' in bio_lower
            )
            if is_cj and 'chief justice' not in desig_lower:
                display_designation = "Chief Justice"
            else:
                display_designation = designation

            judge_content = "[JUDGE PROFILE]\n"
            judge_content += f"Name: {judge_name}\n"
            if court:
                judge_content += f"Court: {court}\n"
            if display_designation:
                judge_content += f"Designation: {display_designation}\n"
            if status:
                judge_content += f"Status: {status}\n"
            judge_content += f"Chief Justice: {'Yes' if is_cj else 'No'}\n"
            if doa:
                judge_content += f"Appointed: {doa}\n"
            if image_url:
                judge_content += f'\n<img src="{image_url}" width="200" height="250" />\n'
            if bio:
                judge_content += f"\n[BIOGRAPHY]\n{bio}\n"

            lines.append(
                f"[Doc {i} of {n}] {judge_name} | judge_name={judge_name} | {doc_type} | {court} | score={score:.3f}\n"
                f"{judge_content}"
            )
        else:
            # ── CASE/LEGAL DOCUMENT formatting ──
            # Use the ACTUAL fields from ingested data
            case_title = m.get("case_title", "") or m.get("title", "Untitled")
            case_number = m.get("case_number", "")
            judge = m.get("judge", "")
            citation = m.get("citation", "")
            court = m.get("court", "")
            year = m.get("year", "")
            petitioner = m.get("petitioner", "")
            respondent = m.get("respondent", "")
            pdf_url = m.get("pdf_url", "")
            decision_date = m.get("decision_date", "")

            matched_chunk = d["content"][:2500]

            # Build a rich header from actual case metadata
            header_parts = []
            if case_title and case_title != "Untitled":
                header_parts.append(f"Case: {case_title}")
            if case_number:
                header_parts.append(f"Case No: {case_number}")
            if judge:
                header_parts.append(f"Judge(s): {judge}")
            if citation and citation != "Citation Awaited":
                header_parts.append(f"Citation: {citation}")
            if petitioner and respondent:
                header_parts.append(f"Parties: {petitioner} v. {respondent}")
            if decision_date:
                header_parts.append(f"Date: {decision_date}")

            case_header = "\n".join(header_parts)
            display_title = case_title if case_title != "Untitled" else case_number

            doc_content = ""
            if case_header:
                doc_content += f"[CASE INFO]\n{case_header}\n\n"
            doc_content += f"[PASSAGE]\n{matched_chunk}\n"

            lines.append(
                f"[Doc {i} of {n}] {display_title} | {doc_type} | "
                f"{court} | {year} | score={score:.3f} | "
                f"pdf_url={pdf_url}\n"
                f"{doc_content}"
            )
    
    header = f"=== {n} RETRIEVED DOCUMENTS ===\n"
    # LOW RELEVANCE WARNING only applies to case-law (rerank scores go 0-10+).
    # Judge profile queries use BM25 scores (max ~1.0) so the threshold is
    # irrelevant — skip the warning if all docs are judge profiles.
    all_judge_docs = all(
        d.get("metadata", {}).get("doc_type", "") in ("isb_judge", "lhc_judge", "lhc_judge_new", "sc_judge")
        for d in docs
    )
    if not all_judge_docs and best_score < RERANK_WARN:
        header += (
            f"⚠️ LOW RELEVANCE WARNING: Best score is {best_score:.2f}. "
            "These documents may NOT directly answer the query. "
            "If they are irrelevant, tell the user honestly and do NOT fabricate an answer.\n"
        )
    return header + "\n---\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
#  TOOL DEFINITIONS
# ══════════════════════════════════════════════════════════════════════════════

_CASE_DOC_TYPES_ALL = ["sc_case", "isb_case", "lhc_case", "federal_law", "punjab_law"]


def _infer_case_doc_types(query: str) -> List[str]:
    q = (query or "").lower()
    asks_sc = any(k in q for k in ["supreme court", "sc ", " sc", "supreme"])
    asks_ihc = any(k in q for k in ["islamabad high court", "ihc", "isb court", "islamabad court"])
    asks_lhc = any(k in q for k in ["lahore high court", "lhc", "lahore court"])

    # Detect constitutional/statutory provision references.
    # When a query mentions Article/Section numbers, SC cases are almost always
    # relevant because the Supreme Court is the primary authority for
    # constitutional and statutory interpretation — include them even if the
    # user only named a High Court.
    import re as _infer_re
    has_provision = bool(_infer_re.search(r'\b(?:article|section|s\.)\s*\d', q, _infer_re.IGNORECASE))

    # Detect statute/act queries — these should always include federal_law
    _STATUTE_KEYWORDS = [
        "act ", " act", "ordinance", "statute", "federal law",
        "punjab law", "penal code", "evidence act", "contract act",
        "limitation act", "family courts act", "muslim family",
        "specific relief", "companies act",
    ]
    asks_statutes = any(k in q for k in _STATUTE_KEYWORDS)
    asks_punjab = "punjab" in q

    selected: List[str] = []
    if asks_sc:
        selected.append("sc_case")
    if asks_ihc:
        selected.append("isb_case")
    if asks_lhc:
        selected.append("lhc_case")

    # When a constitutional/statutory provision is mentioned, always include
    # SC cases as they are the authoritative source for interpretation.
    if has_provision and "sc_case" not in selected:
        selected.append("sc_case")

    # When statutes/acts are mentioned, include the statute corpora.
    if asks_statutes or has_provision:
        if "federal_law" not in selected:
            selected.append("federal_law")
        if asks_punjab and "punjab_law" not in selected:
            selected.append("punjab_law")

    if not selected:
        return _CASE_DOC_TYPES_ALL

    # preserve order while deduplicating
    return list(dict.fromkeys(selected))


def _map_court_to_case_doc_types(court: str) -> Optional[List[str]]:
    c = (court or "").lower()
    if "supreme" in c:
        return ["sc_case"]
    if "islamabad" in c or "ihc" in c:
        return ["isb_case"]
    if "lahore" in c or "lhc" in c:
        return ["lhc_case"]
    return None

@tool
def search_case_law(query: str) -> str:
    """
    Search Pakistani case law across Supreme Court and Islamabad High Court.
    Use this when the user mentions a legal dispute, criminal offence,
    civil matter, or asks about judicial precedents and judgments.

    Input: natural language legal query
    Returns: top relevant case excerpts with court, year, and title
    """
    doc_types = _infer_case_doc_types(query)
    complex_query = _is_complex_query_text(query)

    # HYBRID SEARCH (Enriched Vector + Optimized BM25)
    hybrid_k = 24 if complex_query else 16
    mmr_k =  8 if complex_query else  6
    rerank_k = 5 if complex_query else  4

    enriched = query_rewriter_service.enrich_query(query)
    results = _hybrid_search(enriched, top_k=hybrid_k, doc_type_filter=doc_types)

    # MMR diversity filter → cross-encoder reranking
    diverse = _mmr(results, top_k=mmr_k)
    final = _rerank(query, diverse, top_k=rerank_k)
    return _format_results(final)


# ── COMMENTED OUT: Not yet ingested (LHC-only scope for now) ──────────────
# @tool
# def search_federal_laws(query: str) -> str:
#     """Search Federal Laws of Pakistan."""
#     q_vec = embed_query(query)
#     hits = _weaviate_search(q_vec, top_k=20, doc_type_filter="federal_law")
#     diverse = _mmr(hits, top_k=10)
#     final = _rerank(query, diverse, top_k=5)
#     return _format_results(final)
#
# @tool
# def search_punjab_laws(query: str) -> str:
#     """Search Punjab Provincial Laws."""
#     q_vec = embed_query(query)
#     hits = _weaviate_search(q_vec, top_k=20, doc_type_filter="punjab_law")
#     diverse = _mmr(hits, top_k=10)
#     final = _rerank(query, diverse, top_k=5)
#     return _format_results(final)
# ── END COMMENTED OUT ─────────────────────────────────────────────────────


def _parse_qdrant_points(points) -> List[Dict[str, Any]]:
    """Convert Qdrant ScoredPoint objects into our standard dict format."""
    results = []
    for point in points:
        payload = point.payload or {}
        results.append({
            "content": payload.get("content", ""),
            "metadata": {
                "doc_type": payload.get("doc_type", ""),
                "title": payload.get("title", ""),
                "court": payload.get("court", ""),
                "year": payload.get("year", ""),
                "pdf_url": payload.get("pdf_url", ""),
                "image_url": payload.get("image_url", ""),
                "source_id": payload.get("source_id", ""),
                "chunk_index": payload.get("chunk_index", 0),
            },
            "score": point.score if hasattr(point, 'score') else 0.0,
        })
    return results


@tool
def search_judge_profiles(query: str) -> str:
    """
    Search profiles and biographical information of Pakistani judges.
    Use this when the user asks: who is a specific judge, a judge's history,
    which judges presided over a type of case, or judicial appointment details.

    Input: judge name, court name, or description of the judge being sought
    Returns: judge profile information
    """
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue, HasIdCondition
    import logging
    logger = logging.getLogger(__name__)

    q_vec = embeddings_service.embed_query(query)
    query_lower = query.lower()
    query_norm = re.sub(r"[^a-z0-9]+", " ", query_lower).strip()
    
    logger.warning(f"[JUDGE-TOOL] Received query: {query}")
    
    # In Qdrant, we need to search each judge type separately since contains_any isn't available
    # Include ALL judge doc_type variants (lhc_judge_new, lhc_judge, sc_judge, isb_judge)
    judge_types = ["sc_judge", "lhc_judge", "lhc_judge_new", "isb_judge"]
    
    client = qdrant_service.get_qdrant_client()

    # ── Detect which court the user is asking about ──
    asks_sc = any(kw in query_lower for kw in ["supreme court", "sc ", "chief justice of pakistan"])
    asks_ihc = any(kw in query_lower for kw in ["islamabad high court", "ihc", "islamabad court"])
    asks_lhc = any(kw in query_lower for kw in ["lahore high court", "lhc", "lahore court"])
    # If no court specified, it's general
    court_filter = None
    if asks_sc:
        court_filter = "Supreme Court of Pakistan"
    elif asks_ihc:
        court_filter = "Islamabad High Court"
    elif asks_lhc:
        court_filter = "Lahore High Court"
    
    # ── Detect if user asks about FORMER or CURRENT judges ──
    former_keywords = ["former", "retired", "ex-", "previous", "past", "old", "was ", "were ", "who was"]
    asks_former = any(kw in query_lower for kw in former_keywords)
    
    # ── Detect if user asks about a SPECIFIC judge by name ──
    import re as _re
    # Match "justice <Name>", "judge <Name>", "chief justice <Name>" or full names like "Khadim Hussain Soomro" or single names like "Bashir"
    # A name starts with a letter and is NOT a preposition/article
    non_name_words = {"of", "the", "and", "or", "in", "at", "for", "from", "to", "is", "are", "was", "were", "who", "what", "tell", "about", "background", "history", "information", "profile"}
    listing_words = {
        "find", "list", "show", "all", "judges", "judge", "courts", "court", "named",
        "with", "from", "in", "at", "current", "former", "sitting", "senior",
    }
    has_specific_name = False
    soft_name_tokens: list[str] = []

    def _normalize_name(value: str) -> str:
        # Optimized regex to strip stacks of titles: "Honourable Chief Justice Mr. Justice Sardar..." -> "Sardar..."
        cleaned = _re.sub(r"^(?:former\s+|retired\s+|honourable\s+|hon'ble\s+|mr\.?|mrs\.?|ms\.?|miss|dr\.?|justice|chief justice|chief judge|additional|sitting)\s+", "", value.strip(), flags=_re.IGNORECASE)
        # Repeat once to handle stacked cases like "Honourable Mr. Justice"
        cleaned = _re.sub(r"^(?:former\s+|retired\s+|honourable\s+|hon'ble\s+|mr\.?|mrs\.?|ms\.?|miss|dr\.?|justice|chief justice|chief judge|additional|sitting)\s+", "", cleaned.strip(), flags=_re.IGNORECASE)
        cleaned = _re.sub(r"[^a-z0-9]+", " ", cleaned.lower())
        return _re.sub(r"\s+", " ", cleaned).strip()

    def _clean_extracted_name(value: str) -> str:
        tokens = [t.strip(".,;:?!") for t in value.split() if t.strip(".,;:?!")]
        cleaned_tokens = []
        tail_stopwords = {
            "the", "former", "current", "judge", "justice", "chief", "profile", "information",
            "background", "history", "details", "about", "named", "name", "from", "in", "at",
            "list", "find", "search", "who", "what", "was", "is", "of", "court", "courts",
            "high", "lahore", "islamabad", "supreme", "pakistan", "honourable", "hon'ble",
        }
        for token in tokens:
            if token.lower() in tail_stopwords:
                continue # Skip stopword and continue
            cleaned_tokens.append(token)
        return " ".join(cleaned_tokens).strip()

    is_listing_like = any(phrase in query_lower for phrase in [
        "find judges", "list judges", "show judges", "judges from", "judges in",
        "judges at", "judges named", "judges with", "current judges", "former judges",
        "sitting judges", "chief justices", "all judges", "senior judges",
    ])
    
    # Strategy 1: "chief justice <Name>", "chief judge <Name>", "justice <Name>" or "judge <Name>"
    name_match = _re.search(r'(?:chief\s+)?(?:justice|judge)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', query, _re.IGNORECASE)
    if name_match and name_match.group(1).lower() not in non_name_words:
        extracted_candidate = _clean_extracted_name(name_match.group(1))
        if extracted_candidate:
            has_specific_name = True

    # Strategy 2: Capitalized multi-word names like "Khadim Hussain Soomro"
    if not has_specific_name and not is_listing_like:
        # Look for capitalized names (at least two words starting with capital letters)
        name_match = _re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', query)
        if name_match:
            potential_name = name_match.group(1).lower()
            # Exclude common non-name words and listing-like phrases
            if potential_name not in non_name_words and not any(stop in potential_name for stop in ["court", "justice", "judge"]):
                has_specific_name = True

    # Strategy 3: Single-word names only when the query itself is short and name-like.
    # This avoids false positives such as "Find judges with the name Khan in Lahore High Court".
    if not has_specific_name and not is_listing_like:
        words = [w for w in query.split() if w]
        if len(words) <= 3:
            for word in words:
                if word[0].isupper() and len(word) >= 4 and word.lower() not in non_name_words:
                    has_specific_name = True
                    break

    if not has_specific_name:
        soft_stopwords = non_name_words | listing_words | {
            "lahore", "high", "court", "supreme", "islamabad", "pakistan",
            "named", "name", "judges", "judge", "former", "current", "sitting",
            "senior", "chief", "justices", "justice",  # 'justice' is a title, not a name
        }
        for word in query.split():
            cleaned = word.strip(".,;:?!()[]{}\"'")
            if cleaned and cleaned[0].isupper() and len(cleaned) >= 4 and cleaned.lower() not in soft_stopwords:
                soft_name_tokens.append(cleaned.lower())
    
    logger.warning(f"[JUDGE-TOOL] asks_former={asks_former}, has_specific_name={has_specific_name}, asks_sc={asks_sc}, asks_ihc={asks_ihc}")
    
    # ── EARLY EXIT: If user asks about SC/IHC judges and we have no data ──
    if asks_sc or asks_ihc:
        # Check if we actually have data for that court
        target_court = "sc_judge" if asks_sc else "isb_judge"
        try:
            target_filter = QdrantFilter(must=[
                FieldCondition(key="doc_type", match=MatchValue(value=target_court))
            ])
            # Use scroll to count
            points, _ = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=target_filter,
                limit=1,
                with_payload=False,
                with_vectors=False,
            )
            # If we got no points, count is 0
            court_count = 1 if points else 0
        except Exception:
            court_count = 0
        
        court_name = "Supreme Court of Pakistan" if asks_sc else "Islamabad High Court"
        if court_count == 0:
            logger.warning(f"[JUDGE-TOOL] No {target_court} data in database. Returning honest message.")
            return (f"⚠️ NO DATA AVAILABLE: The database currently does not contain any "
                    f"{court_name} judge profiles. Only Lahore High Court judge data "
                    f"is currently ingested ({405} judge profile chunks). "
                    f"Please ingest {court_name} judge data to enable these queries.")

    # ── Detect if this is a listing query (used by both strategies) ──
    list_keywords = ["justices", "judges", "all", "list", "every", "were the", "are the"]
    is_listing_query = any(kw in query_lower for kw in list_keywords)

    # ── FEATURE: If user asked for SPECIFIC NAME, find ALL judges matching that name ──
    # extracted_name initialized here so Strategy B can always reference it safely
    extracted_name = None
    if has_specific_name:
        # Extract the judge name from query
        # Look for patterns like "Justice X Y", "X Y Soomro", etc.
        import re as name_re
        name_patterns = [
            r'(?:justice|judge|chief justice)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        ]
        
        extracted_name = None
        for pattern in name_patterns:
            match = name_re.search(pattern, query, name_re.IGNORECASE)
            if match:
                extracted_name = _clean_extracted_name(match.group(1))
                break
        
        if extracted_name:
            extracted_name_lower = _normalize_name(extracted_name)
            logger.warning(f"[JUDGE-TOOL] Extracted name: '{extracted_name}'")
            
            # Search database for all judges matching this name
            all_matching = []
            try:
                # Filter scroll by judge doc_types — avoids pulling the entire collection.
                # Previously scrolled 1000 points unfiltered = O(n) on every judge name query.
                all_points = []
                for jtype in judge_types:
                    _type_filter = QdrantFilter(must=[
                        FieldCondition(key="doc_type", match=MatchValue(value=jtype))
                    ])
                    _batch, _ = client.scroll(
                        collection_name=COLLECTION_NAME,
                        scroll_filter=_type_filter,
                        limit=500,
                        with_payload=True,
                        with_vectors=False,
                    )
                    all_points.extend(_batch)

                # Iterate all gathered points AFTER all batches have been collected
                for point in all_points:
                    payload = point.payload or {}
                    doc_type = payload.get("doc_type", "")
                    if doc_type not in judge_types:
                        continue

                    if court_filter and payload.get("court", "") != court_filter:
                        continue

                    judge_name = payload.get("judge_name", "")
                    judge_name_norm = _normalize_name(judge_name)

                    # Check if name matches EXACTLY on normalized text or is a safe substring match.
                    # This is intentionally strict to avoid returning similar-but-wrong judges.
                    if extracted_name_lower == judge_name_norm or extracted_name_lower in judge_name_norm:
                        all_matching.append({
                            "content": payload.get("content", ""),
                            "metadata": {
                                "doc_type": doc_type,
                                "title": payload.get("title", "") or payload.get("judge_name", ""),
                                "judge_name": payload.get("judge_name", ""),
                                "court": payload.get("court", ""),
                                "year": payload.get("year", ""),
                                "pdf_url": payload.get("pdf_url", ""),
                                "image_url": payload.get("image_url", ""),
                                "source_id": payload.get("source_id", ""),
                                "chunk_index": payload.get("chunk_index", 0),
                                "status": payload.get("status", ""),
                                "is_chief_justice": payload.get("is_chief_justice", False),
                                "designation": payload.get("designation", ""),
                            },
                            "score": 10.0,  # High score for exact name match
                        })
                
                if all_matching:
                    logger.warning(f"[JUDGE-TOOL] Found {len(all_matching)} judge(s) matching '{extracted_name}'")
                    for m in all_matching:
                        logger.warning(f"  Match: {m['metadata']['judge_name']}")

                    if soft_name_tokens:
                        def _soft_name_boost(doc: dict) -> tuple[int, float]:
                            meta = doc.get("metadata", {})
                            candidate = _normalize_name(meta.get("judge_name", "") or meta.get("title", ""))
                            token_hits = sum(1 for token in soft_name_tokens if token in candidate)
                            return (token_hits, doc.get("score", 0.0))

                        all_matching.sort(key=_soft_name_boost, reverse=True)
                    
                    # Format and return all matching judges
                    max_output = 10
                    return _format_results(all_matching[:max_output])
            except Exception as e:
                logger.warning(f"[JUDGE-TOOL] Error searching for name matches: {e}")
    
    # ── Strategy A: Current/sitting judges (not former, no specific name) ──
    if not asks_former and not has_specific_name:
        bm25_limit = 30 if is_listing_query else 15
        rerank_top = 15 if is_listing_query else 5

        # Restrict doc_type search to the requested court only (avoids mixing courts)
        if asks_ihc:
            active_judge_types = ["isb_judge"]
        elif asks_sc:
            active_judge_types = ["sc_judge"]
        elif asks_lhc:
            active_judge_types = ["lhc_judge", "lhc_judge_new"]
        else:
            active_judge_types = judge_types   # no specific court → search all

        # Search judge profiles using keyword search
        bm25_query = f"{query} sitting designation chief justice"
        bm25_results = _bm25_search(
            bm25_query,
            top_k=bm25_limit,
            doc_type_filter=active_judge_types,
            court_filter=court_filter,
        )
        
        logger.warning(f"[JUDGE-TOOL] BM25 results: {len(bm25_results)}")
        for i, doc in enumerate(bm25_results):
            status = doc['metadata'].get('status', '')
            logger.warning(f"  BM25[{i}] title={doc['metadata']['title']}, score={doc['score']:.3f}, status={status}")

        # Filter BM25 results to ONLY keep SITTING judges, prioritizing CURRENT Chief Justices
        active_results = []
        current_chief_justices = []

        for doc in bm25_results:
            status = (doc['metadata'].get('status') or '').upper()
            is_chief = doc['metadata'].get('is_chief_justice', False)
            designation_lower = (doc['metadata'].get('designation') or '').lower()
            content_lower = doc["content"].lower()

            # Treat None/empty status as ACTIVE (data gap — assume sitting unless explicitly FORMER)
            is_former = (status == 'FORMER') or ('former' in content_lower[:120] and 'former chief' not in designation_lower[:80])

            # Detect CJ via flag, designation, OR judge_name/title containing 'Chief Justice'
            title_lower = (doc['metadata'].get('title') or doc['metadata'].get('judge_name') or '').lower()
            is_cj = is_chief or 'chief justice' in designation_lower or 'chief justice' in title_lower

            if not is_former:
                active_results.append(doc)
                if is_cj:
                    current_chief_justices.append(doc)
        
        # Priortize Chief Justices ONLY when user explicitly asks about the Chief Justice.
        # For general listing queries ("list all sitting judges"), keep ALL active results.
        asks_cj_specifically = any(kw in query_lower for kw in [
            "chief justice", "chief judge", "cj of"
        ])
        if current_chief_justices and asks_cj_specifically and not is_listing_query:
            # Return CJ immediately — don’t merge with vector results that the
            # cross-encoder will then use to demote the correct CJ in reranking.
            logger.warning(f"[JUDGE-TOOL] CJ query — returning {len(current_chief_justices)} CJ result(s) directly.")
            return _format_results(current_chief_justices[:rerank_top])
        
        logger.warning(f"[JUDGE-TOOL] Active BM25 results (SITTING): {len(active_results)}, CURRENT CJ: {len(current_chief_justices)}")
        for doc in active_results:
            status = doc['metadata'].get('status', 'UNKNOWN')
            is_chief = doc['metadata'].get('is_chief_justice', False)
            logger.warning(f"  Active: {doc['metadata']['title']} (status={status}, chief_justice={is_chief})")

        # If we have enough active results, rerank only them (don’t mix in vector results)
        if len(active_results) >= 3:
            final = _rerank(query, active_results, top_k=rerank_top)
        else:
            # Fallback: also do vector search if BM25 didn’t find enough active judges
            vector_results = []
            for jtype in active_judge_types:
                results = _qdrant_vector_search(
                    q_vec,
                    top_k=bm25_limit,
                    doc_type_filter=jtype,
                    court_filter=court_filter,
                )
                vector_results.extend(results)
            
            # Only keep active vector results (SITTING judges, prioritize CURRENT Chief Justices)
            active_vector = []
            current_cj_vector = []
            
            for d in vector_results:
                status = (d['metadata'].get('status') or '').upper()
                is_chief = d['metadata'].get('is_chief_justice', False)
                designation_lower = (d['metadata'].get('designation') or '').lower()
                content_lower = d["content"].lower()

                is_former = (status == 'FORMER') or ('former' in content_lower[:120] and 'former chief' not in designation_lower[:80])

                if not is_former:
                    active_vector.append(d)
                    # Check flag, designation, AND judge_name/title
                    title_lower_v = (d['metadata'].get('title') or d['metadata'].get('judge_name') or '').lower()
                    if is_chief or 'chief justice' in designation_lower or 'chief justice' in title_lower_v:
                        current_cj_vector.append(d)
            
            # Prioritize CURRENT chief justices from vector search  
            if current_cj_vector:
                active_vector = current_cj_vector

            # Merge active from both sources, deduplicate
            seen_keys = set()
            merged = []
            for doc in active_results + active_vector:
                key = (doc["metadata"].get("title", ""), doc["metadata"].get("chunk_index", 0))
                if key not in seen_keys:
                    seen_keys.add(key)
                    merged.append(doc)

            if merged:
                final = _rerank(query, merged, top_k=rerank_top)
            else:
                # Last resort: rerank all vector results
                final = _rerank(query, vector_results, top_k=rerank_top)

        # ── BOOST Chief Justices in final ranking ──
        # Prioritize CJ via flag, designation, or judge_name/title
        cj_in_final = []
        other_in_final = []
        for doc in final:
            is_chief = doc['metadata'].get('is_chief_justice', False)
            desig_l = (doc['metadata'].get('designation') or '').lower()
            title_l = (doc['metadata'].get('title') or doc['metadata'].get('judge_name') or '').lower()
            if is_chief or 'chief justice' in desig_l or 'chief justice' in title_l:
                cj_in_final.append(doc)
            else:
                other_in_final.append(doc)

        final = cj_in_final + other_in_final

        if soft_name_tokens and final:
            def _soft_name_hits(doc: dict) -> int:
                meta = doc.get("metadata", {})
                candidate = _normalize_name(meta.get("judge_name", "") or meta.get("title", ""))
                return sum(1 for token in soft_name_tokens if token in candidate)

            name_filtered = [doc for doc in final if _soft_name_hits(doc) > 0]
            if name_filtered:
                final = sorted(
                    name_filtered,
                    key=lambda doc: (
                        _soft_name_hits(doc),
                        doc.get("rerank_score", doc.get("score", 0.0)),
                    ),
                    reverse=True,
                )
            # If soft filter eliminates all results, don't show an error — just
            # return the best active results we have (avoids false 'no data' messages
            # when the query words like 'Pakistan' or 'Justice' aren't in judge names)

        logger.warning(f"[JUDGE-TOOL] Final results (after CJ boost): {len(final)}")
        for i, doc in enumerate(final):
            is_chief = doc['metadata'].get('is_chief_justice', False)
            logger.warning(f"  Final[{i}] title={doc['metadata']['title']}, is_chief={is_chief}, rerank={doc.get('rerank_score', 0):.3f}")

    # ── Strategy B: User explicitly wants FORMER judges OR specific named judge ──
    else:
        fetch_limit = 25 if is_listing_query else 15

        # BM25 search
        bm25_results = _bm25_search(query, top_k=fetch_limit, doc_type_filter=judge_types)

        # Vector search — search each judge type separately
        vector_results = []
        for jtype in judge_types:
            results = _qdrant_vector_search(q_vec, top_k=fetch_limit, doc_type_filter=jtype)
            vector_results.extend(results)

        # Merge and deduplicate (BM25 first so name-matches rank higher)
        seen_keys = set()
        merged = []
        for doc in bm25_results + vector_results:
            key = (doc["metadata"].get("title", ""), doc["metadata"].get("chunk_index", 0))
            if key not in seen_keys:
                seen_keys.add(key)
                merged.append(doc)

        if has_specific_name and extracted_name:
            # ── SPECIFIC NAME: skip cross-encoder, use keyword-match scoring ──
            # The cross-encoder (MS MARCO) has no knowledge of Pakistani proper names
            # and routinely gives negative scores to correct matches, destroying retrieval.
            # Instead: score each doc by how many name tokens appear in judge_name/content.
            name_tokens = extracted_name.lower().split()
            for doc in merged:
                jn = doc["metadata"].get("judge_name", "").lower()
                ct = doc.get("content", "").lower()
                hit_count = sum(1 for t in name_tokens if t in jn or t in ct)
                doc["rerank_score"] = float(hit_count)
                doc["metadata"]["rerank_score"] = float(hit_count)
            # Sort by name-token hits descending, then take top results
            merged.sort(key=lambda d: d.get("rerank_score", 0.0), reverse=True)
            final = merged[:8]
        else:
            # ── FORMER / GENERIC: cross-encoder reranker is acceptable here ──
            final = _rerank(query, merged, top_k=15 if is_listing_query else 8)

        # Only boost former judges when user explicitly asks for former
        if asks_former:
            former_final = []
            active_final = []
            for doc in final:
                cl = doc["content"].lower()
                has_former = any(w in cl for w in ["former chief justice", "retired", "former judge", "past chief justice"])
                if has_former:
                    former_final.append(doc)
                else:
                    active_final.append(doc)
            final = former_final + active_final

    # ── Final court-mismatch check ──
    # If ALL results are from a different court than what the user asked about, warn
    if final:
        result_courts = set()
        for doc in final[:5]:
            ct = doc.get("content", "").lower()
            if "lahore high court" in ct:
                result_courts.add("lhc")
            elif "supreme court" in ct:
                result_courts.add("sc")
            elif "islamabad" in ct:
                result_courts.add("ihc")
        
        # Guard: only warn when retrieved docs genuinely don't contain the requested court.
        # Check actual doc_type metadata, NOT content text (content may not have the abbreviation).
        has_sc_docs  = any(d.get("metadata", {}).get("doc_type") == "sc_judge"  for d in final)
        has_ihc_docs = any(d.get("metadata", {}).get("doc_type") == "isb_judge" for d in final)

        if asks_sc and not has_sc_docs:
            return "⚠️ No Supreme Court judge profiles were found for this query in the database."
        if asks_ihc and not has_ihc_docs:
            return "⚠️ No Islamabad High Court judge profiles were found for this query in the database."

    # Determine output limit: listing queries get more results
    max_output = 10 if is_listing_query else 5

    return _format_results(final[:max_output])


@tool
def search_by_court_and_topic(court: str, topic: str) -> str:
    """
    Search cases or documents from a SPECIFIC court on a SPECIFIC topic.
    Use this when the user explicitly specifies a court AND a legal topic.

    court: e.g. 'Supreme Court of Pakistan', 'Islamabad High Court'
    topic: the legal subject matter to search for

    Returns: top relevant court-specific documents on the topic
    """
    court_doc_types = _map_court_to_case_doc_types(court)
    if not court_doc_types:
        return (
            "⚠️ NO MATCHING DATA: Court not recognized. "
            "Please use Supreme Court of Pakistan or Islamabad High Court."
        )

    hits = _hybrid_search(topic, top_k=28, doc_type_filter=court_doc_types)
    diverse = _mmr(hits, top_k=10)
    final = _rerank(topic, diverse, top_k=6)
    return _format_results(final)


@tool
def search_by_year_and_topic(year: str, topic: str) -> str:
    """
    Search legal documents from a SPECIFIC YEAR on a topic.
    Use this when the user asks about cases or laws from a particular year.

    year: 4-digit year string e.g. '2022'
    topic: the legal subject matter

    Returns: relevant documents from that year
    """
    hits = _hybrid_search(topic, top_k=20, year_filter=year)
    diverse = _mmr(hits, top_k=10)
    final = _rerank(topic, diverse, top_k=5)
    return _format_results(final)


@tool
def retrieve_with_full_pipeline(query: str) -> str:
    """
    Run the complete RAG pipeline across currently ingested Pakistani case-law corpus.
    Use this as the FINAL synthesis step after gathering info from specific tools,
    OR when the query is broad.

    Input: the original or refined user query
    Returns: top relevant documents across SC/IHC/LHC case-law corpus
    """
    doc_types = _infer_case_doc_types(query)
    complex_query = _is_complex_query_text(query)

    # HYBRID SEARCH (Enriched Vector + Optimized BM25)
    hybrid_k = 24 if complex_query else 16
    mmr_k =  8 if complex_query else  6
    rerank_k = 5 if complex_query else  4

    enriched = query_rewriter_service.enrich_query(query)
    all_results = _hybrid_search(enriched, top_k=hybrid_k, doc_type_filter=doc_types)

    diverse = _mmr(all_results, top_k=mmr_k, lambda_mult=0.5)
    final = _rerank(query, diverse, top_k=rerank_k)
    return _format_results(final)


@tool
def analyze_legal_question(query: str) -> str:
    """
    Analyze and decompose a complex legal question into its components.
    Use this FIRST when the query is long, complex, involves multiple legal issues,
    or when you need to identify what type of law / court / topic is involved
    before deciding which other tools to call.

    Input: user's raw legal question
    Returns: structured breakdown of legal issues, applicable law areas,
             recommended courts to search, and a search strategy
    """
    from backend.services.llm import llm_service
    llm = llm_service.get_llm()

    analysis_prompt = f"""You are a Pakistani legal expert. Analyze this legal query and produce a structured breakdown.

Query: {query}

Respond in this exact format:
LEGAL_ISSUES: [comma-separated list of legal issues/offences/topics]
LAW_AREAS: [Criminal / Civil / Constitutional / Family / Property / Commercial / Administrative]
RELEVANT_COURTS: [Supreme Court / Lahore High Court / Islamabad High Court / all]
RELEVANT_STATUTES: [list any Pakistani laws/acts/sections that seem relevant]
KEY_SEARCH_TERMS: [optimized search terms for legal database]
COMPLEXITY: [Simple / Multi-issue / Requires multiple searches]
STRATEGY: [1-2 sentences: what tools to call next and why]"""

    response = llm.invoke(analysis_prompt)
    return response.content


@tool
def check_database_coverage(topic: str) -> str:
    """
    Check how many documents exist for a given topic in the database.
    Use this when you're unsure if the database has enough coverage on a topic,
    or to tell the user what data is available.

    Input: topic or document type to check
    Returns: count stats and coverage information
    """
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue
    
    client = qdrant_service.get_qdrant_client()
    
    try:
        # Check if collection exists
        collection_info = client.get_collection(COLLECTION_NAME)
    except Exception:
        return "Database collection does not exist yet. Please run ingestion first."

    # Count total points
    total = collection_info.points_count or 0

    # Count per doc_type
    counts = {}
    for dt in ["sc_case", "isb_case", "lhc_case", "federal_law", "punjab_law",
               "sc_judge", "isb_judge", "lhc_judge"]:
        try:
            doc_filter = QdrantFilter(must=[
                FieldCondition(key="doc_type", match=MatchValue(value=dt))
            ])
            # Use count API if available, otherwise use scroll
            try:
                count = client.count(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=doc_filter,
                )
                counts[dt] = count.count
            except:
                # Fallback: scroll and count
                points, _ = client.scroll(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=doc_filter,
                    limit=10000,
                    with_payload=False,
                    with_vectors=False,
                )
                counts[dt] = len(points) if points else 0
        except Exception:
            counts[dt] = 0

    lines = [f"Total chunks in database: {total:,}", "", "Breakdown by document type:"]
    for dt, cnt in counts.items():
        lines.append(f"  {dt}: {cnt:,} chunks")
    lines.append(f"\nSearch topic requested: '{topic}'")
    return "\n".join(lines)


# ─── Export all tools as a list ───────────────────────────────────────────────
ALL_TOOLS = [
    analyze_legal_question,
    search_case_law,
    # search_federal_laws,    # Not yet ingested (LHC-only scope)
    # search_punjab_laws,     # Not yet ingested (LHC-only scope)
    search_judge_profiles,
    search_by_court_and_topic,
    search_by_year_and_topic,
    retrieve_with_full_pipeline,
    check_database_coverage,
]