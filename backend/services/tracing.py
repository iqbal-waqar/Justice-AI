"""LangSmith tracing.

Enabled purely by environment variables (off by default):
    LANGSMITH_TRACING=true
    LANGSMITH_API_KEY=lsv2_...
    LANGSMITH_PROJECT=justice-ai           (optional)
    LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com   (optional, EU region)

With tracing on, LangChain/LangGraph record every graph node, LLM call (full
prompt + response) and tool call automatically. The non-LangChain retrieval steps
(Voyage embedding, Qdrant hybrid search, Voyage rerank) are wrapped with
`traceable` below so they appear as timed child steps with compact summaries.
With tracing off, `traceable` is a no-op wrapper and nothing leaves the server.
"""
import os
from typing import Any, Dict, List, Optional

from langsmith import traceable  # noqa: F401  (re-exported for the services)


def tracing_enabled() -> bool:
    flag = (os.getenv("LANGSMITH_TRACING") or os.getenv("LANGCHAIN_TRACING_V2") or "").strip().lower()
    return flag in ("1", "true", "yes") and bool(os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY"))


def log_tracing_status() -> None:
    if tracing_enabled():
        project = os.getenv("LANGSMITH_PROJECT") or os.getenv("LANGCHAIN_PROJECT") or "default"
        print(f"🔭 LangSmith tracing ON → project '{project}'")
    else:
        print("ℹ️ LangSmith tracing off (set LANGSMITH_TRACING=true + LANGSMITH_API_KEY to enable)")


def run_config(query: str, history: Optional[List[dict]], surface: str) -> Dict[str, Any]:
    """LangGraph run config: a readable name + tags/metadata for filtering in LangSmith."""
    return {
        "run_name": "Justice AI query",
        "tags": [surface, "follow-up" if history else "first-turn"],
        "metadata": {"query": query[:300], "history_messages": len(history or []), "surface": surface},
    }


# ── compact summaries so traces show what was found without full judgment text ──

def summarize_docs(docs: Any) -> Dict[str, Any]:
    if not isinstance(docs, list):
        return {"output": docs}
    rows = []
    for d in docs[:20]:
        m = (d or {}).get("metadata", {}) if isinstance(d, dict) else {}
        rows.append({
            "title": (m.get("title") or m.get("judge_name") or "")[:90],
            "doc_type": m.get("doc_type"),
            "year": m.get("year"),
            "chunk": m.get("chunk_index"),
            "score": round(float(d.get("rerank_score", d.get("score", 0)) or 0), 4) if isinstance(d, dict) else None,
        })
    return {"count": len(docs), "top": rows}


def summarize_vector(vec: Any) -> Dict[str, Any]:
    try:
        return {"dimensions": len(vec)}
    except TypeError:
        return {"output": str(vec)[:100]}


def summarize_search_inputs(inputs: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in inputs.items() if k in ("query", "top_k", "doc_type_filter", "court_filter", "year_filter")}


def summarize_rerank_inputs(inputs: Dict[str, Any]) -> Dict[str, Any]:
    cands = inputs.get("candidates") or []
    return {"query": inputs.get("query"), "candidates": len(cands) if isinstance(cands, list) else cands}
