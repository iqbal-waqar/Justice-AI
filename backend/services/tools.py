import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher

import requests
from typing import Optional, List, Dict, Any
from langchain.tools import tool

from backend.services.qdrant import qdrant_service, COLLECTION_NAME
from backend.services.embeddings import embeddings_service
from backend.services.sparse import sparse_service
from backend.services.tracing import (
    traceable, summarize_docs, summarize_search_inputs, summarize_rerank_inputs,
)
from langsmith.run_helpers import get_current_run_tree, tracing_context

# One keep-alive HTTPS session for Voyage rerank (a fresh requests.post per call
# re-did the TLS handshake every query).
_voyage_session = requests.Session()


class SearchUnavailable(Exception):
    """The embedding service or the vector database could not be reached."""


# Prefix of the tool message the graph sees when a search tool fails. The agent
# reports an outage for it instead of treating it as "nothing found".
SEARCH_UNAVAILABLE = "SEARCH_UNAVAILABLE"


def tool_error_message(e: Exception) -> str:
    print(f"⚠️ Search tool failed ({e.__class__.__name__}): {str(e)[:200]}")
    return f"{SEARCH_UNAVAILABLE}: {e.__class__.__name__}"


# ─── Core retrieval helpers ────────────────────────────────────────────────────

def _qfilter(doc_type_filter: Optional[Any] = None, court_filter: Optional[str] = None, year_filter: Optional[Any] = None):
    """Build a server-side Qdrant filter (doc_type and year accept a str or a list)."""
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
        # `year` is a keyword index (decision year as "2020"), so ranges are
        # expressed as the explicit list of years.
        if isinstance(year_filter, (list, tuple, set)):
            must.append(FieldCondition(key="year", match=MatchAny(any=[str(y) for y in year_filter])))
        else:
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
            "date_of_appointment": payload.get("date_of_appointment", ""),
            "profile_url": payload.get("profile_url", ""),
        },
        "score": getattr(scored_point, "score", 0.0) or 0.0,
    }


def _qdrant_vector_search(
    query_vector: List[float],
    top_k: int = 20,
    doc_type_filter: Optional[Any] = None,
    court_filter: Optional[str] = None,
    year_filter: Optional[str] = None,
    raise_on_error: bool = False,
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
        if raise_on_error:
            raise SearchUnavailable(f"vector database: {e.__class__.__name__}") from e
        return []
    return [_map_point(p) for p in points][:top_k]


@traceable(name="Qdrant hybrid search", run_type="retriever",
           process_inputs=summarize_search_inputs, process_outputs=summarize_docs)
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
    scroll or in-Python BM25 rebuild. Returns top-K for the reranker.
    """
    from qdrant_client.models import Prefetch, FusionQuery, Fusion

    client = qdrant_service.get_qdrant_client()
    qfilter = _qfilter(doc_type_filter, court_filter, year_filter)

    try:
        dense_vec = embeddings_service.embed_query(query)
        sparse_vec = sparse_service.embed_query(query)
    except Exception as e:
        print(f"Hybrid embed error: {e}")
        raise SearchUnavailable(f"embedding service: {e.__class__.__name__}") from e

    def _run(c):
        return c.query_points(
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

    try:
        try:
            response = _run(client)
        except Exception as first_err:
            # The client is cached without per-call health pings, so a dropped
            # connection surfaces here: reconnect once and retry.
            print(f"Hybrid query error ({first_err.__class__.__name__}) — reconnecting to Qdrant and retrying")
            response = _run(qdrant_service.reset_qdrant_client())
        points = response.points if hasattr(response, "points") else response
    except Exception as e:
        print(f"Hybrid query error: {e} — falling back to dense-only")
        return _qdrant_vector_search(dense_vec, top_k, doc_type_filter, court_filter, year_filter,
                                     raise_on_error=True)

    return [_map_point(p) for p in points][:top_k]


# Minimum rerank score — stricter floor to reduce weak matches.
RERANK_FLOOR = 0.0

@traceable(name="Voyage rerank", run_type="chain",
           process_inputs=summarize_rerank_inputs, process_outputs=summarize_docs)
def _voyage_rerank(query: str, candidates: List[Dict]) -> Optional[List[Dict]]:
    """Rerank via Voyage's hosted rerank API (fast, no CPU). Returns None on failure."""
    key = os.getenv("VOYAGE_API_KEY", "").strip()
    if not key:
        return None
    docs = [d.get("content", "") or " " for d in candidates]
    try:
        resp = _voyage_session.post(
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


def _keep_fused_order(candidates: List[Dict]) -> List[Dict]:
    """Fallback when Voyage rerank is unavailable: keep the hybrid (RRF) order.

    A local cross-encoder fallback used to live here, but it pulled in torch +
    transformers (~7s import, ~1GB) and could never run in practice — rerank only
    happens after a successful Voyage query embedding, so a Voyage outage fails
    earlier. RRF order is a sound ranking on its own.
    """
    for d in candidates:
        s = float(d.get("score", 0.0))
        d["rerank_score"] = s
        d["metadata"]["rerank_score"] = s
    return candidates


_CHUNK_HEADER_RE = re.compile(r"^\s*\[(?:CASE|LAW|JUDGE)\][^\n]*\n+")


def _strip_chunk_header(content: str, position: int) -> str:
    """Every ingested chunk starts with the same '[CASE] title | court | year'
    line; when merging several chunks of one case keep it only once."""
    return content if position == 0 else _CHUNK_HEADER_RE.sub("", content, count=1)


def _rerank(query: str, candidates: List[Dict], top_k: int = 5, max_chunks_per_case: int = 1) -> List[Dict]:
    """Rerank (Voyage hosted → fused-order fallback), group by case, floor-filter.

    top_k counts distinct cases. With max_chunks_per_case > 1, a case's
    next-best relevant passages are appended to its first one (in judgment
    order) instead of being dropped — one case = one document block, so the
    model never writes duplicate case cards.
    """
    if not candidates:
        return []
    ranked = _voyage_rerank(query, candidates)
    if ranked is None:
        ranked = _keep_fused_order(candidates)

    groups: Dict[str, List[Dict]] = {}
    order: List[str] = []
    for d in ranked:
        title = d.get("metadata", {}).get("title", "").strip().lower() or f"__untitled_{id(d)}"
        if title not in groups:
            groups[title] = []
            order.append(title)
        if len(groups[title]) < max_chunks_per_case:
            groups[title].append(d)

    deduped: List[Dict] = []
    for title in order[:top_k]:
        chunks = groups[title]
        head = chunks[0]
        if len(chunks) > 1:
            parts = sorted(chunks, key=lambda c: c.get("metadata", {}).get("chunk_index", 0))
            merged = dict(head)
            merged["content"] = "\n[…]\n".join(_strip_chunk_header(c.get("content", ""), i) for i, c in enumerate(parts))
            deduped.append(merged)
        else:
            deduped.append(head)
    # Filter out results below the relevance floor
    filtered = [d for d in deduped if d["rerank_score"] >= RERANK_FLOOR]
    return filtered if filtered else deduped[:1]  # always return at least 1

RERANK_WARN = 0.3


_JUDGE_DOC_TYPES = ("isb_judge", "lhc_judge", "sc_judge")


def _merge_judge_docs(docs: List[Dict]) -> List[Dict]:
    """One profile per judge. A judge is stored as several chunks (profile header
    + biography pieces); returning each as its own 'document' showed one judge as
    'Found 6 profiles' and repeated the same person 6 times in the prompt."""
    merged: Dict[str, Dict] = {}
    order: List[str] = []
    for d in docs:
        m = d.get("metadata", {})
        if m.get("doc_type") not in _JUDGE_DOC_TYPES:
            key = f"__doc_{id(d)}"
            merged[key] = d
            order.append(key)
            continue
        # Two courts can each have a judge of the same name — keep them apart.
        name = (m.get("judge_name") or m.get("title") or "").strip().lower()
        key = f"{m.get('doc_type')}|{name}" if name else f"__judge_{id(d)}"
        if key not in merged:
            merged[key] = {**d, "_parts": [d]}
            order.append(key)
        else:
            merged[key]["_parts"].append(d)
            if d.get("score", 0) > merged[key].get("score", 0):
                merged[key]["score"] = d["score"]
    out = []
    for key in order:
        d = merged[key]
        parts = d.pop("_parts", None)
        if parts and len(parts) > 1:
            parts = sorted(parts, key=lambda p: p.get("metadata", {}).get("chunk_index", 0))
            seen, texts = set(), []
            for p in parts:
                t = (p.get("content") or "").strip()
                if t and t not in seen:
                    seen.add(t)
                    texts.append(t)
            d = {**d, "content": "\n\n".join(texts)}
        out.append(d)
    return out


_EXCERPT_STOPWORDS = {
    "what", "does", "about", "under", "with", "from", "that", "this", "there", "their",
    "which", "when", "where", "have", "been", "will", "would", "could", "should", "into",
    "case", "cases", "court", "judgment", "judgments", "pakistan", "say", "says", "the",
    "and", "for", "law", "laws", "legal", "section", "article", "act", "can", "file",
}

# A provision the question names ("Section 17", "s. 489-F", "Article 199", "Order XXXVII").
_ASKED_PROVISION_RE = re.compile(
    r"\b(?:sections?|s\.|u/s|articles?|art\.|order|rule)\s*(\d{1,4}(?:\s*-?\s*[A-Za-z])?|[IVXL]{1,7})\b", re.I)


def _provision_heading(passage: str, query: str) -> Optional[int]:
    """Position where a provision named in the question starts in the passage
    ("17. Matters to be considered…"), so a cut keeps that provision's text."""
    for num in _ASKED_PROVISION_RE.findall(query or ""):
        num = re.sub(r"\s+", "", num)
        variant = re.escape(num).replace("\\-", "\\s*-?\\s*") if "-" in num else re.escape(num)
        m = re.search(rf"(?:^|[\s\]\(])({variant})\s*\.\s*[\[\(\"“A-Z]", passage)
        if m:
            return m.start(1)
    return None


def focused_excerpt(passage: str, query: str, width: int = 900) -> str:
    """Return the `width`-char window of `passage` that matters for the question.

    A long statute or judgment is cut to fit the model's context; keeping only its
    beginning dropped the part that answers the question (e.g. a subsection near
    the end of a section). The window starts at a provision the question names,
    if the passage contains it; otherwise it is the stretch densest in the
    question's terms.
    """
    if len(passage) <= width:
        return passage
    start = None
    heading = _provision_heading(passage, query)
    if heading is not None:
        start = max(0, heading - 80)
    else:
        terms = {t for t in re.findall(r"[a-z0-9\-]+", (query or "").lower())
                 if (len(t) > 3 or t.isdigit()) and t not in _EXCERPT_STOPWORDS}
        low = passage.lower()
        hits = sorted(m.start() for t in terms for m in re.finditer(re.escape(t), low))
        if not hits:
            return passage[:width]
        best_count = -1
        for h in hits:
            s = max(0, h - 150)
            count = sum(1 for x in hits if s <= x < s + width)
            if count > best_count:
                start, best_count = s, count
    start = min(start, len(passage) - width)
    snippet = passage[start:start + width]
    return ("…" if start > 0 else "") + snippet + ("…" if start + width < len(passage) else "")


def _format_results(docs: List[Dict], query: str = "") -> str:
    """Format retrieved docs for the agent."""
    if not docs:
        return "NO MATCHING DATA — no relevant documents found for this query."

    docs = _merge_judge_docs(docs)
    lines = []
    n = len(docs)
    best_score = max(d.get("rerank_score", d.get("score", 0)) for d in docs)


    for i, d in enumerate(docs, 1):
        m = d.get("metadata", {})
        score = d.get("rerank_score", d.get("score", 0))
        doc_type = m.get("doc_type", "")

        # ── Special formatting for JUDGE PROFILES ──
        if doc_type in _JUDGE_DOC_TYPES:
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
                judge_content += f"Appointed to the bench (date of elevation as a judge, not as Chief Justice): {doa}\n"
            if image_url:
                # Markdown image: the chat renders Markdown, never raw HTML.
                judge_content += f"\n![{judge_name}]({image_url})\n"
            if bio:
                judge_content += f"\n[BIOGRAPHY]\n{bio}\n"

            lines.append(
                f"[Doc {i} of {n}] {judge_name} | judge_name={judge_name} | {doc_type} | {court} | score={score:.3f}"
                f" | pdf_url={m.get('profile_url', '')}\n"
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

            # Room for up to two merged passages per case; the synthesis context
            # budget (CONTEXT_MAX_TOTAL_CHARS) is what bounds the total.
            matched_chunk = focused_excerpt(d["content"], query, 5200) if query else d["content"][:5200]

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
    # LOW RELEVANCE WARNING applies to case-law rerank scores only; judge profiles
    # are matched on name / court / status, so the threshold says nothing about them.
    all_judge_docs = all(
        d.get("metadata", {}).get("doc_type", "") in _JUDGE_DOC_TYPES
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

# court_rules: the Lahore High Court Rules and Orders (ingest_court_rules.py).
# district_case: Punjab district-court judgments, OCR'd from scans (ingest_district_courts.py).
_CASE_DOC_TYPES_ALL = ["sc_case", "isb_case", "lhc_case", "district_case", "federal_law", "punjab_law", "court_rules"]


def _map_court_to_case_doc_types(court: str) -> Optional[List[str]]:
    c = (court or "").lower()
    if "supreme" in c:
        return ["sc_case"]
    if "islamabad" in c or "ihc" in c:
        return ["isb_case"]
    if "district" in c:
        return ["district_case"]
    if "lahore" in c or "lhc" in c:
        return ["lhc_case"]
    return None

# Retrieval funnel: wide hybrid recall → Voyage rerank of every candidate → distinct cases.
# (Was 16 → 6 → 4, which capped every answer at 4 cases from a 16-chunk pool.)
HYBRID_K = int(os.getenv("RETRIEVAL_HYBRID_K", "48"))
FINAL_CASES = int(os.getenv("RETRIEVAL_FINAL_CASES", "6"))
FINAL_CASES_COMPLEX = int(os.getenv("RETRIEVAL_FINAL_CASES_COMPLEX", "8"))
CHUNKS_PER_CASE = int(os.getenv("RETRIEVAL_CHUNKS_PER_CASE", "2"))


def _run_case_search_impl(query: str, years: Optional[List[str]] = None,
                          doc_types: Optional[List[str]] = None, broad: bool = False) -> str:
    """Shared hybrid → rerank pipeline for the case-law/statute tools.

    The query-understanding step decides the arguments: an English search query
    (statutes named, Urdu translated), decision `years`, `doc_types` when the
    user limited the courts, and `broad` for multi-part / statute questions
    (more cases in the answer).

    `years` is applied as a server-side Qdrant filter. If the filter leaves
    nothing, the search is re-run without it and the output says so explicitly,
    so the answer can't pretend the cases are from those years.
    """
    doc_types = list(doc_types) if doc_types else _CASE_DOC_TYPES_ALL
    final_k = FINAL_CASES_COMPLEX if broad else FINAL_CASES

    year_list = [str(y) for y in years] if years else None
    results = _hybrid_search(query, top_k=HYBRID_K, doc_type_filter=doc_types, year_filter=year_list)

    note = ""
    if year_list and not results:
        results = _hybrid_search(query, top_k=HYBRID_K, doc_type_filter=doc_types)
        span = year_list[0] if len(year_list) == 1 else f"{year_list[0]}–{year_list[-1]}"
        note = (f"⚠️ YEAR FILTER: no documents decided in {span} matched this query. The documents "
                f"below are from OTHER years — say so explicitly and do not present them as {span} judgments.\n")
    elif year_list:
        span = year_list[0] if len(year_list) == 1 else f"{year_list[0]}–{year_list[-1]}"
        note = f"ℹ️ YEAR FILTER applied: only documents decided in {span}.\n"

    # Every candidate goes to the reranker. A diversity (MMR) cut to 14 used to sit
    # here; measured on 8 legal queries it dropped better-scoring cases in 6 of them
    # and saved no time — grouping by case in _rerank already prevents duplicates.
    final = _rerank(query, results, top_k=final_k, max_chunks_per_case=CHUNKS_PER_CASE)
    out = _format_results(final, query)
    if note and out.startswith("==="):
        head, _, rest = out.partition("\n")
        out = f"{head}\n{note}{rest}"
    return out



# ─── Speculative prefetch ─────────────────────────────────────────────────────
# understand_query starts the case search in the background the moment the
# query is known, while the LLM intent classifier runs. When the tool is then
# dispatched with the same (query, years) it reuses the in-flight result instead
# of searching again — hiding the classifier's ~1.3s entirely.
_prefetch_lock = threading.Lock()
_prefetch: Dict[tuple, tuple] = {}          # key → (Future, started_at)
_prefetch_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="prefetch")
_PREFETCH_TTL = 60.0


def _search_key(query: str, years: Optional[List[str]], doc_types: Optional[List[str]] = None,
                broad: bool = False) -> tuple:
    return (" ".join((query or "").split()), tuple(str(y) for y in years) if years else (),
            tuple(sorted(doc_types)) if doc_types else (), bool(broad))


def prefetch_case_search(query: str, years: Optional[List[str]] = None,
                         doc_types: Optional[List[str]] = None, broad: bool = False) -> None:
    """Begin the case search now; a later _run_case_search with the same args reuses it."""
    key = _search_key(query, years, doc_types, broad)
    parent = get_current_run_tree()  # keep the background search inside the LangSmith trace

    def job():
        with tracing_context(parent=parent):
            return _run_case_search_impl(query, years, doc_types, broad)

    now = time.time()
    with _prefetch_lock:
        for k in [k for k, (_, t0) in _prefetch.items() if now - t0 > _PREFETCH_TTL]:
            _prefetch.pop(k, None)  # abandoned (intent turned out to be a judge/out-of-scope query)
        if key not in _prefetch:
            _prefetch[key] = (_prefetch_pool.submit(job), now)


def _run_case_search(query: str, years: Optional[List[str]] = None,
                     doc_types: Optional[List[str]] = None, broad: bool = False) -> str:
    with _prefetch_lock:
        entry = _prefetch.pop(_search_key(query, years, doc_types, broad), None)
    if entry is not None:
        return entry[0].result()
    return _run_case_search_impl(query, years, doc_types, broad)


@tool
def search_case_law(query: str, years: Optional[List[str]] = None,
                    doc_types: Optional[List[str]] = None, broad: bool = False) -> str:
    """
    Search Pakistani case law (Supreme Court, Islamabad High Court, Lahore High Court, Punjab district courts)
    and statutes. Use this when the user mentions a legal dispute, criminal offence,
    civil matter, or asks about judicial precedents and judgments.

    query: natural language legal query
    years: optional list of decision years to restrict to, e.g. ["2020"]
    doc_types: optional collections to restrict to (sc_case, lhc_case, isb_case, district_case, federal_law, punjab_law, court_rules)
    broad: return more cases (multi-part questions)
    Returns: top relevant case excerpts with court, year, and title
    """
    return _run_case_search(query, years, doc_types, broad)




# ─── Judge profiles ───────────────────────────────────────────────────────────
# What is being asked (one named judge, a Chief Justice, a list, a description)
# is decided by the query-understanding step and arrives as arguments. The tool
# only matches those arguments against the stored profiles — it does not
# interpret the wording of the question.
_COURT_JUDGE_TYPES = {"supreme_court": "sc_judge", "lahore_high_court": "lhc_judge",
                      "islamabad_high_court": "isb_judge"}
_JUDGE_CACHE_TTL = 600.0
_judge_cache: Dict[str, Any] = {"at": 0.0, "profiles": []}
_judge_cache_lock = threading.Lock()
# Honorifics are how a court prints a name, not part of the name being matched.
_NAME_TITLES = {"mr", "mrs", "ms", "miss", "dr", "justice", "chief", "honourable", "honorable",
                "hon", "ble", "former", "the", "sir", "judge", "retired", "retd", "senior", "puisne"}
JUDGE_FULL_PROFILES = 8     # up to this many judges are returned with full biographies
JUDGE_ROSTER_LIMIT = 40     # longer lists are returned as a compact roster, capped here


def _name_tokens(name: str) -> List[str]:
    return [t for t in re.findall(r"[a-z]+", (name or "").lower()) if len(t) > 1 and t not in _NAME_TITLES]


def _load_judge_profiles() -> List[Dict]:
    """Every judge profile, one entry per judge (their chunks merged in order).
    The whole set is a few hundred records, so it is read once and kept for
    ten minutes instead of being searched approximately on every question."""
    from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchAny
    with _judge_cache_lock:
        if _judge_cache["profiles"] and time.time() - _judge_cache["at"] < _JUDGE_CACHE_TTL:
            return _judge_cache["profiles"]
    client = qdrant_service.get_qdrant_client()
    qfilter = QdrantFilter(must=[FieldCondition(key="doc_type", match=MatchAny(any=list(_JUDGE_DOC_TYPES)))])
    points, offset = [], None
    try:
        while True:
            batch, offset = client.scroll(collection_name=COLLECTION_NAME, scroll_filter=qfilter, limit=500,
                                          offset=offset, with_payload=True, with_vectors=False)
            points.extend(batch)
            if offset is None:
                break
    except Exception as e:
        if _judge_cache["profiles"]:
            return _judge_cache["profiles"]          # stale is better than nothing
        raise SearchUnavailable(f"vector database: {e.__class__.__name__}") from e

    grouped: Dict[tuple, List[Dict]] = {}
    for p in points:
        d = _map_point(p)
        m = d["metadata"]
        name = (m.get("judge_name") or m.get("title") or "").strip()
        if name:
            grouped.setdefault((m.get("doc_type"), name), []).append(d)
    profiles = []
    for (_, name), chunks in grouped.items():
        chunks.sort(key=lambda c: c["metadata"].get("chunk_index", 0))
        texts = list(dict.fromkeys(t for t in ((c.get("content") or "").strip() for c in chunks) if t))
        head = chunks[0]
        meta = dict(head["metadata"])
        for c in chunks[1:]:                         # a later chunk may carry a field the first lacks
            for k, v in c["metadata"].items():
                if v and not meta.get(k):
                    meta[k] = v
        meta["judge_name"] = name
        meta["title"] = meta.get("title") or name
        profiles.append({"content": "\n\n".join(texts), "metadata": meta, "score": 0.0,
                         "_tokens": set(_name_tokens(name))})
    with _judge_cache_lock:
        _judge_cache.update(at=time.time(), profiles=profiles)
    return profiles


def _is_former(profile: Dict) -> bool:
    m = profile["metadata"]
    return (m.get("status") or "").upper() == "FORMER" or (m.get("designation") or "").lower().startswith("former")


def _is_chief_justice(profile: Dict) -> bool:
    m = profile["metadata"]
    return bool(m.get("is_chief_justice")) or "chief justice" in (m.get("designation") or "").lower()


def _by_status(profiles: List[Dict], status: str) -> List[Dict]:
    if status == "sitting":
        return [p for p in profiles if not _is_former(p)]
    if status == "former":
        return [p for p in profiles if _is_former(p)]
    return profiles


def _scored(profiles: List[Dict], score: float) -> List[Dict]:
    out = []
    for p in profiles:
        d = {k: v for k, v in p.items() if k != "_tokens"}
        d["metadata"] = dict(p["metadata"])
        d["score"] = d["rerank_score"] = score
        out.append(d)
    return out


def _match_name(profiles: List[Dict], name: str):
    """Profiles whose name contains every word of the asked name. Returns
    (matches, exact) — exact is False when only a looser match was found
    (spelling variants such as Mansur/Mansoor, or all but one word)."""
    asked = _name_tokens(name)
    if not asked:
        return [], False

    def extra(p):                                    # closest-length name first, sitting before former
        return (len(p["_tokens"]) - len(asked), _is_former(p))

    exact = [p for p in profiles if all(t in p["_tokens"] for t in asked)]
    if exact:
        return sorted(exact, key=extra), True

    def similar(t, have):
        # Short words (Ali / Alvi, Khan / Khar) must match exactly; longer ones may differ by a letter.
        return t in have or (len(t) >= 5 and any(SequenceMatcher(None, t, h).ratio() >= 0.8 for h in have))

    loose = [p for p in profiles if all(similar(t, p["_tokens"]) for t in asked)]
    if not loose and len(asked) >= 3:
        loose = [p for p in profiles if sum(similar(t, p["_tokens"]) for t in asked) >= len(asked) - 1]
    return sorted(loose, key=extra), False


def _with_note(out: str, note: str) -> str:
    if note and out.startswith("==="):
        head, _, rest = out.partition("\n")
        return f"{head}\n{note}\n{rest}"
    return out


def _judge_roster(profiles: List[Dict], score: float = 10.0) -> str:
    """A few judges → full profiles. Many → a compact roster (name, court,
    designation, status) so a list request can show the whole bench."""
    if len(profiles) <= JUDGE_FULL_PROFILES:
        return _format_results(_scored(profiles, score))
    shown = _scored(profiles[:JUDGE_ROSTER_LIMIT], score)
    for d in shown:
        d["content"] = ""
        d["metadata"]["image_url"] = ""
    note = (f"ℹ️ ROSTER: {len(profiles)} judges match; "
            + (f"only the first {len(shown)} are shown — say so. " if len(profiles) > len(shown) else "all are shown. ")
            + "Names and designations only (no biographies).")
    return _with_note(_format_results(shown), note)


def _judge_semantic_search(query: str, doc_types: List[str], status: str, profiles: List[Dict]) -> str:
    """Find judges by what their biography says (education, career, background)."""
    hits = _hybrid_search(query, top_k=30, doc_type_filter=doc_types)
    by_key = {(p["metadata"].get("doc_type"), p["metadata"]["judge_name"]): p for p in _by_status(profiles, status)}
    hits = [h for h in hits if (h["metadata"].get("doc_type"), (h["metadata"].get("judge_name") or "").strip()) in by_key]
    if not hits:
        return "NO DATA AVAILABLE — no judge profile in the collection matches this description."
    final = []
    for h in _rerank(query, hits, top_k=5):
        full = by_key[(h["metadata"].get("doc_type"), h["metadata"]["judge_name"].strip())]
        final.extend(_scored([full], h.get("rerank_score", h.get("score", 0.0))))
    return _format_results(final)


@tool
def search_judge_profiles(query: str, request: str = "describe", name: Optional[str] = None,
                          courts: Optional[List[str]] = None, status: str = "any") -> str:
    """
    Look up profiles of Pakistani judges (Supreme Court, Lahore High Court, Islamabad High Court).

    query: the question in English (used when searching biographies by description)
    request: named_judge | chief_justice | list | describe
    name: named_judge — the judge's name, without titles
    courts: optional — supreme_court, lahore_high_court, islamabad_high_court
    status: sitting | former | any
    Returns: the matching judge profile(s)
    """
    doc_types = [_COURT_JUDGE_TYPES[c] for c in (courts or []) if c in _COURT_JUDGE_TYPES] or list(_JUDGE_DOC_TYPES)
    everyone = _load_judge_profiles()
    pool = [p for p in everyone if p["metadata"].get("doc_type") in doc_types]

    if request == "named_judge" and name:
        matches, exact = _match_name(pool, name)
        if not matches and len(pool) != len(everyone):
            matches, exact = _match_name(everyone, name)      # the user may have named the wrong court
        if not matches:
            return (f"NO DATA AVAILABLE — no judge named '{name}' is in the collection "
                    "(it holds profiles of Supreme Court, Lahore High Court and Islamabad High Court judges).")
        out = _format_results(_scored(matches[:JUDGE_FULL_PROFILES], 10.0 if exact else 9.0))
        if not exact:
            out = _with_note(out, f"ℹ️ NAME MATCH: no profile is named exactly '{name}'. The profile(s) below are the "
                                  "closest names — state the name as stored and that it may be a different person.")
        return out

    if request == "chief_justice":
        chiefs = [p for p in pool if _is_chief_justice(p)]
        chosen = _by_status(chiefs, "former" if status == "former" else "sitting")
        if not chosen and status == "any":
            chosen = chiefs
        if chosen:
            return _judge_roster(chosen)
        # The court's records carry no Chief Justice marker — look in the biographies.
        return _judge_semantic_search(query, doc_types, status, everyone)

    if request == "list":
        chosen = sorted(_by_status(pool, status), key=lambda p: (not _is_chief_justice(p) or _is_former(p),
                                                                  p["metadata"]["judge_name"]))
        if not chosen:
            return "NO DATA AVAILABLE — no judge profiles in the collection match this court and status."
        return _judge_roster(chosen)

    return _judge_semantic_search(query, doc_types, status, everyone)


@tool
def retrieve_with_full_pipeline(query: str, years: Optional[List[str]] = None,
                                doc_types: Optional[List[str]] = None, broad: bool = True) -> str:
    """
    Run the complete RAG pipeline across the ingested Pakistani case-law and statute corpus.
    Use this for broad, provision-focused or statutory questions.

    query: the original or refined user query
    years: optional list of decision years to restrict to, e.g. ["2018", "2019", "2020"]
    doc_types: optional collections to restrict to
    broad: return more cases (default for this tool)
    Returns: top relevant documents across SC/IHC/LHC case law and statutes
    """
    return _run_case_search(query, years, doc_types, broad)



# ─── Export all tools as a list ───────────────────────────────────────────────
# Only tools the agent actually dispatches (see nodes.dispatch_search / refine_and_retry).
ALL_TOOLS = [
    search_case_law,
    retrieve_with_full_pipeline,
    search_judge_profiles,
]