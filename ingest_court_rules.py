"""Add the Lahore High Court Rules and Orders (Volumes I–IV) to the research corpus.

The Rules and Orders are the High Court's standing instructions to the courts of
the Punjab: how suits, criminal cases, guardianship, insolvency, records and
court-fee are to be handled. This script:
  1. reads Volumes I–IV (the text PDFs kept for the Law library in data/library_seed/;
     Volume V and the amendment files are scanned images and are not indexed),
  2. drops the contents pages and the page numbers / running headers,
  3. follows the CHAPTER and PART headings so every chunk is labelled with where it
     sits ("Volume III, Chapter 1 (…), Part E (…), Rules 1–4"),
  4. stores the chunks in Qdrant as doc_type "court_rules", linked to the official PDF.

Safe to re-run: earlier chunks of a volume are replaced, not duplicated.

    python ingest_court_rules.py --dry-run
    python ingest_court_rules.py
"""
import argparse
import os
import re
import sys
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

ROOT = os.path.dirname(os.path.abspath(__file__))
SEED_DIR = os.path.join(ROOT, "data", "library_seed")
CHUNK_CHARS = 3200
OFFICIAL = "https://lhc.gov.pk/system/files/"

VOLUMES = [
    {"num": 1, "roman": "I", "subject": "Instructions to Civil Courts", "file": "lhc-rules-orders-vol1.pdf",
     "pdf_url": OFFICIAL + "Volume1_0.pdf"},
    {"num": 2, "roman": "II", "subject": "Instructions to Civil Courts (Special Jurisdiction and Accounts)",
     "file": "lhc-rules-orders-vol2.pdf", "pdf_url": OFFICIAL + "volume2_compressed_0.pdf"},
    {"num": 3, "roman": "III", "subject": "Instructions to Criminal Courts", "file": "lhc-rules-orders-vol3.pdf",
     "pdf_url": OFFICIAL + "volume3_0.pdf"},
    {"num": 4, "roman": "IV", "subject": "Instructions to Civil Courts", "file": "lhc-rules-orders-vol4.pdf",
     "pdf_url": OFFICIAL + "volume4_0.pdf"},
]

_CHAPTER_RE = re.compile(r"^\s*CHAPTER\s+(\d{1,2}|[IVXL]{1,6})\s*$")
_PART_RE = re.compile(r"^\s*PART(?:\s+|\s*[-–—]\s*)([A-Z]|[IVX]{1,4})\b\s*([-–—:.]+)?\s*(.*)$", re.I)


def _is_part_heading(m) -> bool:
    """"PART A -- GENERAL", "Part V – Inspection", "PART B" — not a sentence that
    happens to begin "Part A of this chapter…": a heading has a dash or colon after
    the letter, or is written in capitals, or has nothing after it."""
    rest = m.group(3).strip()
    if not rest:
        return True
    letters = [c for c in rest if c.isalpha()]
    capitals = bool(letters) and sum(c.isupper() for c in letters) / len(letters) >= 0.7
    if capitals:
        return True
    # mixed case: a short title after a dash or colon, not a running sentence
    return bool(m.group(2)) and len(rest.split()) <= 8 and "," not in rest
_RULE_RE = re.compile(r"(?m)^\s*(\d{1,3}(?:-[A-Z])?)\.\s+(?=[A-Z(\"“])")
_HEADER_RE = re.compile(r"^\s*\d*\s*High Court Rules and Orders\s*[—–-]\s*Vol\.?\s*[IVX]+\s*\d*\s*$", re.I)


def _title_case(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip(" .-–—:")
    s = re.sub(r"[.…]{2,}.*$", "", s).strip()               # "SUMMARY TRIALS…… [Omitted]"
    return s.title() if s.isupper() else s


def _clean_line(line: str) -> str:
    line = re.sub(r"[#*]{1,4}\[", "", line)                  # amendment markers "#*[", "*["
    line = re.sub(r"\[\s*(?:\.\s*){3}\]", "", line)           # "[...]"
    return line.replace("\xad", "-").replace("‐", "-").rstrip()


def read_volume(vol: Dict) -> List[Tuple[str, str, str]]:
    """[(chapter label, part label, text)] in reading order, from the first chapter on."""
    import pdfplumber
    path = os.path.join(SEED_DIR, vol["file"])
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} is missing — open the Law library once (or restart the backend) to download it")
    with pdfplumber.open(path) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]

    segments, chapter, part, buf = [], None, "", []
    started = False

    def flush():
        text = "\n".join(buf).strip()
        if started and chapter and len(text) > 80:
            segments.append((chapter, part, text))
        buf.clear()

    for page in pages:
        lines = page.split("\n")
        if lines and re.fullmatch(r"\s*\d{1,4}\s*", lines[0]):
            lines = lines[1:]                                 # page number at the top
        if lines and re.fullmatch(r"\s*\d{1,4}\s*", lines[-1]):
            lines = lines[:-1]                                # … or at the bottom
        lines = [l for l in lines if not _HEADER_RE.match(l)]
        i = 0
        while i < len(lines):
            line = _clean_line(lines[i])
            m = _CHAPTER_RE.match(line)
            if m and m.group(1).isalpha() and chapter and re.match(r"Chapter \d", chapter):
                # A Roman-numbered "CHAPTER" after the volume's numbered chapters belongs to a
                # document reproduced inside the current chapter (e.g. a convention in Vol. I).
                flush()
                title = _title_case(_clean_line(lines[i + 1])) if i + 1 < len(lines) else ""
                part = f"Annexed text, Chapter {m.group(1)}" + (f" ({title})" if title else "")
                i += 2
                continue
            if m:
                flush()
                started = True
                title = ""
                if i + 1 < len(lines) and not (_PART_RE.match(lines[i + 1]) and _is_part_heading(_PART_RE.match(lines[i + 1]))) \
                        and not _RULE_RE.match(lines[i + 1]):
                    title = _title_case(_clean_line(lines[i + 1]))
                    i += 1
                chapter = f"Chapter {m.group(1)}" + (f" ({title})" if title else "")
                part = ""
                i += 1
                continue
            pm = _PART_RE.match(line) if started else None
            if pm and len(line) < 120 and not line.rstrip().endswith((",", ";")) and _is_part_heading(pm):
                flush()
                part = f"Part {pm.group(1).upper()}" + (f" ({_title_case(pm.group(3))})" if pm.group(3).strip() else "")
                i += 1
                continue
            if started:
                buf.append(line)
            i += 1
    flush()
    return segments


def build_chunks(vol: Dict, segments: List[Tuple[str, str, str]]) -> List[Dict]:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_CHARS, chunk_overlap=200, is_separator_regex=True,
        separators=[r"\n(?=\d{1,3}(?:-[A-Z])?\.\s+[A-Z(\"“])", r"\n\n", r"\n", r"(?<=[.;:])\s", " "])
    title = f"Lahore High Court Rules and Orders, Volume {vol['roman']}"
    chunks = []
    for chapter, part, text in segments:
        for piece in splitter.split_text(text):
            piece = piece.strip()
            if len(piece) < 80:
                continue
            rules = [m.group(1) for m in _RULE_RE.finditer(piece)]
            where = f"Volume {vol['roman']}, {chapter}" + (f", {part}" if part else "")
            if rules:
                where += f", Rule {rules[0]}" if len(set(rules)) == 1 else f", Rules {rules[0]}–{rules[-1]}"
            chunks.append({
                "doc_type": "court_rules",
                "source_id": f"lhc_rules_orders_vol{vol['num']}",
                "title": title,
                "case_title": title,
                "court": "Lahore High Court",
                "year": "",
                "pdf_url": vol["pdf_url"],
                "category": "Court Rules",
                "jurisdiction": "Punjab",
                "sections": where,
                "content": f"[LAW] {title} ({vol['subject']}) | Lahore High Court\n{where}\n\n{piece}",
            })
    for i, c in enumerate(chunks):
        c["chunk_index"], c["total_chunks"] = i, len(chunks)
    return chunks


def store(vol: Dict, chunks: List[Dict]) -> None:
    from qdrant_client.models import FieldCondition, Filter, MatchValue
    from backend.services.ingestion import ingestion_service
    from backend.services.qdrant import COLLECTION_NAME, qdrant_service
    client = qdrant_service.get_qdrant_client()
    client.delete(COLLECTION_NAME, points_selector=Filter(must=[
        FieldCondition(key="doc_type", match=MatchValue(value="court_rules")),
        FieldCondition(key="source_id", match=MatchValue(value=f"lhc_rules_orders_vol{vol['num']}")),
    ]), wait=True)
    stored = 0
    for i in range(0, len(chunks), 32):
        stored += ingestion_service._upsert(client, chunks[i:i + 32])
    print(f"✅ Volume {vol['roman']}: {stored} chunks stored")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="read and chunk, but store nothing")
    ap.add_argument("--volume", type=int, choices=[1, 2, 3, 4], help="process one volume")
    args = ap.parse_args()
    for vol in VOLUMES:
        if args.volume and vol["num"] != args.volume:
            continue
        segments = read_volume(vol)
        chapters = sorted({s[0] for s in segments}, key=lambda c: segments.index(next(x for x in segments if x[0] == c)))
        chunks = build_chunks(vol, segments)
        sizes = [len(c["content"]) for c in chunks]
        print(f"📘 Volume {vol['roman']} ({vol['subject']}): {len(chapters)} chapters, {len(segments)} parts, "
              f"{len(chunks)} chunks (avg {sum(sizes) // max(1, len(sizes)):,} chars)")
        if args.dry_run:
            for c in (chunks[0], chunks[len(chunks) // 2]):
                print("   ---", c["sections"], "\n  ", c["content"][:260].replace("\n", "\n   "))
            continue
        store(vol, chunks)


if __name__ == "__main__":
    sys.path.insert(0, ROOT)
    main()
