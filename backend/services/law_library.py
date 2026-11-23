"""Federal and Punjab laws for the Law library: read once from the law index
files the corpus was built from (title, year, category, law number, PDF link)."""
import json
import os
import re
import threading
from typing import Dict, List, Optional

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SOURCES = (
    ("Federal", os.path.join(ROOT, "data", "federal_laws", "federal_laws_index.jsonl")),
    ("Punjab", os.path.join(ROOT, "data", "punjab_province_laws", "punjab_laws_index.jsonl")),
)

_lock = threading.Lock()
_laws: Optional[List[Dict]] = None


def _category(raw: str, jurisdiction: str) -> str:
    raw = (raw or "").strip()
    if not raw or raw.lower() in ("punjab provincial law", "none"):
        return "Provincial Laws" if jurisdiction == "Punjab" else "General Laws"
    name = raw.replace("_", " / ")
    return name if name.endswith("s") else name + "s"


def _load() -> List[Dict]:
    laws, seen = [], set()
    for jurisdiction, path in SOURCES:
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                r = json.loads(line)
                title = (r.get("title") or "").strip()
                if not title or (jurisdiction, title.lower()) in seen:
                    continue
                seen.add((jurisdiction, title.lower()))
                year = str(r.get("year") or "").strip()
                law_no = str(r.get("law_no") or "").strip()
                laws.append({
                    "id": f"{jurisdiction[0].lower()}-{r.get('id') or r.get('sr_no') or len(laws)}",
                    "title": title,
                    "jurisdiction": jurisdiction,
                    "category": _category(r.get("category", ""), jurisdiction),
                    "year": year if year.isdigit() else None,
                    "law_no": f"{law_no} of {year}" if law_no and law_no.lower() != "none" and year.isdigit() else None,
                    "pdf_url": r.get("pdf_url") or None,
                    "source_url": r.get("detail_url") or r.get("source") or None,
                })
    laws.sort(key=lambda l: re.sub(r"^(the|a)\s+", "", l["title"].lower()))
    return laws


def all_laws() -> List[Dict]:
    global _laws
    with _lock:
        if _laws is None:
            _laws = _load()
        return _laws


def search_laws(q: str = "", jurisdiction: str = "", category: str = "", page: int = 1, page_size: int = 30) -> Dict:
    laws = all_laws()
    if jurisdiction:
        laws = [l for l in laws if l["jurisdiction"].lower() == jurisdiction.lower()]
    if category:
        laws = [l for l in laws if l["category"].lower() == category.lower()]
    terms = [t for t in re.findall(r"\w+", (q or "").lower())]
    if terms:
        def hay(l):
            return " ".join(filter(None, (l["title"], l["category"], l["year"], l["law_no"]))).lower()
        laws = [l for l in laws if all(t in hay(l) for t in terms)]
        laws.sort(key=lambda l: (not l["title"].lower().startswith(terms[0]), l["title"].lower()))
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    start = (page - 1) * page_size
    everything = all_laws()
    return {
        "total": len(laws),
        "page": page,
        "page_size": page_size,
        "items": laws[start:start + page_size],
        "jurisdictions": sorted({l["jurisdiction"] for l in everything}),
        "categories": sorted({l["category"] for l in everything if not jurisdiction or l["jurisdiction"].lower() == jurisdiction.lower()}),
        "library_total": len(everything),
    }
