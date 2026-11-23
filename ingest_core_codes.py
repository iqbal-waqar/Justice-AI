"""Add the Pakistan Penal Code, 1860 and the Code of Criminal Procedure, 1898.

Both were missing from the scraped federal law list. This script:
  1. downloads the official consolidated PDFs from the Pakistan Code website
     (verified HTTPS; see _session for the site's certificate chain),
  2. keeps only the enacted text (the table of contents is dropped, so a search
     for "section 302" finds the section itself, not its line in the contents),
  3. splits the text section by section and labels every chunk with the
     sections it holds ("Sections 299–302"),
  4. stores the chunks in Qdrant with the same payload as every other law,
  5. adds both codes to the federal law list used by the Law library.

Safe to re-run: earlier chunks of a code are replaced, not duplicated.

    python ingest_core_codes.py --dry-run     # show what would be stored
    python ingest_core_codes.py               # download, chunk, embed, store
"""
import argparse
import json
import os
import re
import ssl
import sys
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(ROOT, "data", "federal_laws", "core_codes")
INDEX_FILE = os.path.join(ROOT, "data", "federal_laws", "federal_laws_index.jsonl")
# Section number → title for each code, read by the agent to check what a cited
# section actually is in Pakistani law (backend/services/nodes.py).
TITLES_FILE = os.path.join(ROOT, "backend", "assets", "core_code_sections.json")
CHUNK_CHARS = 3200          # ≈ 800 tokens of statute text per chunk

CODES = [
    {
        "id": "pakistan_penal_code_1860",
        "title": "Pakistan Penal Code, 1860",
        "abbr": "PPC",
        "year": "1860",
        "law_no": "XLV",
        "category": "Criminal Law",
        "detail_url": "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Npa5lo-sg-jjjjjjjjjjjjj",
        "pdf_url": "https://pakistancode.gov.pk/pdffiles/administratord5622ea3f15bfa00b17d2cf7770a8434.pdf",
        "body_start": r"PAKISTAN PENAL CODE.{0,40}Act\s+No\.?\s*XLV",
        "last_section": 511,
        "tags": ["criminal law", "offences", "punishments"],
    },
    {
        "id": "code_of_criminal_procedure_1898",
        "title": "Code of Criminal Procedure, 1898",
        "abbr": "Cr.P.C.",
        "year": "1898",
        "law_no": "V",
        "category": "Criminal Law",
        "detail_url": "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Npa5lp-sg-jjjjjjjjjjjjj",
        "pdf_url": "https://pakistancode.gov.pk/pdffiles/administrator7db1e56f0f1d39a6e67573ec6b0944e2.pdf",
        "body_start": r"CODE OF CRIMINAL PROCEDURE.{0,40}ACT\s+NO\.?\s*V\s+OF\s+1898",
        "last_section": 565,
        "schedule_two": True,
        "tags": ["criminal procedure", "bail", "trial", "investigation"],
    },
]


# ── download ───────────────────────────────────────────────────────────────
def _session() -> Tuple[requests.Session, object]:
    """A session that verifies pakistancode.gov.pk properly.

    The site serves the wrong intermediate certificate, so ordinary verification
    fails. Instead of turning verification off, fetch the correct intermediate
    from the address named in the site's own certificate (its AIA "CA Issuers"
    field), add it to the trusted bundle, and verify as usual."""
    import certifi
    s = requests.Session()
    s.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) JusticeAI-law-library"
    try:
        s.get("https://pakistancode.gov.pk/", timeout=30)
        return s, True
    except requests.exceptions.SSLError:
        pass
    from cryptography import x509
    from cryptography.hazmat.primitives.serialization import Encoding
    from cryptography.x509.oid import AuthorityInformationAccessOID, ExtensionOID
    leaf = x509.load_pem_x509_certificate(ssl.get_server_certificate(("pakistancode.gov.pk", 443)).encode())
    aia = leaf.extensions.get_extension_for_oid(ExtensionOID.AUTHORITY_INFORMATION_ACCESS).value
    url = next(d.access_location.value for d in aia if d.access_method == AuthorityInformationAccessOID.CA_ISSUERS)
    raw = requests.get(url, timeout=30).content
    try:
        inter = x509.load_der_x509_certificate(raw)
    except ValueError:
        inter = x509.load_pem_x509_certificate(raw)
    bundle = os.path.join(CACHE_DIR, "pakistancode-ca-bundle.pem")
    with open(certifi.where(), "rb") as base, open(bundle, "wb") as out:
        out.write(base.read() + b"\n" + inter.public_bytes(Encoding.PEM))
    s.get("https://pakistancode.gov.pk/", timeout=30, verify=bundle)   # raises if the chain still fails
    print(f"🔐 Verified pakistancode.gov.pk using its issuer's certificate ({inter.subject.rfc4514_string()})")
    return s, bundle


def download(code: Dict, session, verify) -> str:
    path = os.path.join(CACHE_DIR, f"{code['id']}.pdf")
    if os.path.exists(path) and os.path.getsize(path) > 100_000:
        return path
    r = session.get(code["pdf_url"], timeout=180, verify=verify)
    r.raise_for_status()
    if not r.content.startswith(b"%PDF"):
        raise RuntimeError(f"{code['title']}: the download is not a PDF")
    with open(path, "wb") as fh:
        fh.write(r.content)
    print(f"⬇️  {code['title']}: {len(r.content) / 1e6:.1f} MB")
    return path


# ── text ───────────────────────────────────────────────────────────────────
def _clean(text: str) -> str:
    text = text.replace("\xad", "-").replace("\u00a0", " ")
    text = re.sub(r"(?<=\d)[lI](?=\d)", "1", text)          # the PDF's own typos, e.g. "4l7." for 417
    text = re.sub(r"(?m)^\s*Page\s+\d+\s+of\s+\d+\s*$", "", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def enacted_text(code: Dict, pdf_path: str) -> Tuple[str, str]:
    """(contents list, enacted text). The contents list names every section and is
    used only to recognise section starts; it is not stored. The "Page N of M"
    footers are removed."""
    import pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
    start = next((i for i, t in enumerate(pages)
                  if i > 0 and re.search(code["body_start"], re.sub(r"\s+", " ", t[:400]), re.I)), None)
    if start is None:
        raise RuntimeError(f"{code['title']}: could not find where the enacted text begins")
    contents, text = _clean("\n".join(pages[:start])), _clean("\n".join(pages[start:]))
    print(f"📄 {code['title']}: {len(pages)} pages, contents on pages 1–{start}, enacted text from page {start + 1} ({len(text):,} characters)")
    return contents, text


# A section starts on its own line: "302. Punishment…". In this PDF, amendment
# footnote numbers are often glued onto the section number ("655. Arrest…" is
# footnote 6 + section 55; "7, 8112. Order…" is footnotes 7, 8 + section 112), and
# markers such as "4*[", "*" or "]" may surround it. So the whole run of digits is
# captured and resolved against the Code's own contents list.
_SECTION_RE = re.compile(r"(?m)^[ \t]*(?P<run>[\d ,*\[]*?\d+)(?:[ -]?(?P<suf>[A-Z]{1,3}))?\]?\.[ \t]*(?=\S)")
_CHAPTER_RE = re.compile(r"(?m)^[ \t]*(?:[\d*]{1,3}\[)?CHAPTER\s+[IVXLC]+[A-Z-]*\b")
_OMITTED_RE = re.compile(r"^\W{0,3}\d{0,2}\s*\[?\s*\*\s*\*|^\W{0,3}\[?(?:omitted|rep\.|repealed|deleted)"
                         r"|^\W{0,3}\[[^\]]{0,160}\]\s*(?:\d+\s*)?(?:omitted|rep\.|repealed)", re.I)


def _words(s: str, n: int = 2) -> Tuple[str, ...]:
    s = re.sub(r"\d+\[|\]|\[", " ", s.lower())
    return tuple(re.findall(r"[a-z]+", s)[:n])


def _same_title(expected: Tuple[str, ...], opening: str) -> bool:
    """Opening words of a section match its contents entry, allowing the small
    differences between the two ("headmen"/"headman", "qatl-i"/"qatl-e", "Du ties")."""
    from difflib import SequenceMatcher
    if not expected:
        return False
    got = " ".join(_words(opening, len(expected) + 1))
    want = " ".join(expected)
    if got.startswith(want):
        return True
    want_s, got_s = want.replace(" ", ""), got.replace(" ", "")
    return max(SequenceMatcher(None, want_s, got_s[:len(want_s) + extra]).ratio() for extra in (0, 2)) >= 0.8


def _contents_titles(contents: str) -> Dict[str, Tuple[str, ...]]:
    titles = {}
    for m in re.finditer(r"(?m)^[ \t]*(\d{1,3})(?:[ -]?([A-Z]{1,3}))?\.[ \t]*(.+)$", contents):
        label = m.group(1) + (f"-{m.group(2)}" if m.group(2) else "")
        titles.setdefault(label, _words(m.group(3), 3))
    return titles


def split_sections(code: Dict, contents: str, text: str) -> List[Tuple[str, str]]:
    """[(section label, text)] in order.

    A numbered line is a section start when its number and opening words match the
    Code's own contents list, so numbered clauses, footnote tables and schedule rows
    are not mistaken for sections. Numbers must keep rising; repealed ranges may
    leave gaps. Text after the last section (schedules and forms) is kept as one
    "Schedules" part."""
    toc = _contents_titles(contents)
    starts, last_num, seen = [], 0, set()
    for m in _SECTION_RE.finditer(text):
        digits = re.findall(r"\d+", m.group("run"))[-1]
        suf = m.group("suf")
        opening = text[m.end():m.end() + 140]
        chosen = None
        for k in (3, 2, 1):                      # longest reading first: 514 before 14
            if len(digits) < k or digits[-k] == "0":
                continue
            num = int(digits[-k:])
            label = f"{num}" + (f"-{suf}" if suf else "")
            if num > code["last_section"] or num < last_num or label in seen:
                continue
            expected = toc.get(label)
            if expected and (_same_title(expected, opening) or _OMITTED_RE.search(opening)):
                chosen = (num, label)
                break
            if not expected and k == len(digits) and num - last_num <= 3 and not _OMITTED_RE.search(opening):
                chosen = (num, label)     # not in the contents list, but plainly the next section
                break
        if chosen:
            starts.append((m.start(), chosen[1]))
            last_num = chosen[0]
            seen.add(chosen[1])
    if not starts:
        raise RuntimeError(f"{code['title']}: no sections found")

    # Second pass: a section whose wording was later substituted no longer opens with
    # the words in the contents list. Accept its exact number at the start of a line
    # (no digits glued on) when it lies between the sections before and after it.
    def order_key(label):
        m = re.match(r"(\d+)(?:-([A-Z]+))?", label)
        return (int(m.group(1)), m.group(2) or "")
    for label in sorted(toc, key=order_key):
        if label in seen or order_key(label)[0] > code["last_section"] or toc[label][:1] in (("repealed",), ("omitted",)):
            continue
        num, _, suf = label.partition("-")
        before = [p for p, l in starts if order_key(l) < order_key(label)]
        after = [p for p, l in starts if order_key(l) > order_key(label)]
        lo, hi = (max(before) if before else 0), (min(after) if after else len(text))
        pat = re.compile(rf"(?m)^[ \t]*(?:[\d ,*]*\[)*\[?{num}{suf}\]?\.(?=[\s\[(\d\]])")
        hit = next((m for m in pat.finditer(text, lo, hi) if m.start() > lo), None)
        if hit:
            starts.append((hit.start(), label))
            seen.add(label)
    starts.sort()
    missing = [l for l in toc if l not in seen and int(re.match(r"\d+", l).group()) <= code["last_section"]]

    adjusted = []
    for pos, label in starts:
        window = text[max(0, pos - 300):pos]
        ch = list(_CHAPTER_RE.finditer(window))
        adjusted.append((max(0, pos - 300) + ch[-1].start() if ch else pos, label))

    parts = []
    preamble = text[:adjusted[0][0]].strip()
    if preamble:
        parts.append(("Preamble", preamble))
    for i, (pos, label) in enumerate(adjusted):
        end = adjusted[i + 1][0] if i + 1 < len(adjusted) else len(text)
        parts.append((label, text[pos:end].strip()))

    last_label, last_text = parts[-1]
    sched = re.search(r"(?m)^\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH)?\s*SCHEDULE\b", last_text)
    if sched and sched.start() > 200:
        parts[-1] = (last_label, last_text[:sched.start()].strip())
        parts.append(("Schedules", last_text[sched.start():].strip()))
    nums = [p[0] for p in parts if p[0][0].isdigit()]
    print(f"✂️  {code['title']}: {len(nums)} sections found ({nums[0]} … {nums[-1]}); "
          f"{len(toc)} in the contents list; not found in the text: {len(missing)}"
          + (f" (e.g. {', '.join(missing[:8])})" if missing else "")
          + (", plus schedules" if parts[-1][0] == "Schedules" else ""))
    return parts


# ── Schedule II of the Cr.P.C.: the classification of offences ─────────────────
_SCHED_COLS = ("section", "offence", "arrest", "process", "bailable", "compoundable", "punishment", "court")
_DITTO_RE = re.compile(r"^(?:ditto|do)\b[\s.]*$", re.I)


def _cell(c: Optional[str]) -> str:
    c = (c or "").replace("\n", " ").replace("\xad", "-")
    c = re.sub(r"\d+\s*\[\s*\*[\s*]*\]", " ", c)            # "3[* * *]" omissions
    c = re.sub(r"\d?\s*\*(?:\s*\*)+\s*", " ", c)                # stray "2 * * *"
    c = re.sub(r"(?<![A-Za-z])\d{1,2}\s*\[", "", c)            # amendment markers "1 ["
    c = re.sub(r"[\[\]]", "", c)
    c = re.sub(r"(\w)-\s+(\w)", r"\1\2", c)                   # "compound- able" → "compoundable"
    c = re.sub(r"(?i)\bcou?mpounable\b", "compoundable", c)       # the PDF's own misspelling
    c = re.sub(r"\s+", " ", c).strip(" .")
    return c


def _resolve_ditto(cell: str, above: str) -> str:
    """Replace each "Ditto" / "Do." with the entry above. A cell holding two
    sub-rows ("Ditto Warrant") becomes "Summons / Warrant"."""
    if cell in ("", "..", "*"):
        return above
    if not re.search(r"(?i)\b(?:ditto|do)\b", cell):
        return cell
    parts = [p.strip(" .") for p in re.split(r"(?i)\b(?:ditto|do)\b\.?", cell)]
    pieces, seen = [], set()
    tokens = re.split(r"(?i)(\b(?:ditto|do)\b\.?)", cell)
    for t in tokens:
        t = t.strip(" .")
        if not t:
            continue
        value = above if re.fullmatch(r"(?i)(?:ditto|do)", t) else t
        if value.lower() not in seen:
            seen.add(value.lower()); pieces.append(value)
    return " / ".join(pieces) if pieces else above


def _canon(cell: str, word: str) -> str:
    """Clean the bailable / compoundable columns: "Notbailable", "Compoun dable",
    "Compound -able", "compounable" → "Not bailable", "Compoundable"."""
    out = []
    for piece in cell.split(" / "):
        letters, i = "", 0                                    # read the first letters, ignoring spaces / hyphens
        while i < len(piece) and len(letters) < len("not" + word) + 1:
            if piece[i].isalpha():
                letters += piece[i].lower()
            elif piece[i] not in " -":
                break
            i += 1
        neg = letters.startswith("not")
        core = letters[3:] if neg else letters
        stem = "bail" if word == "bailable" else "compoun"
        if core.startswith(stem) and re.match(r"(?:compoundable|compounable|bailable)", core):
            consumed = 0
            target = ("not" if neg else "") + ("compoundable" if word == "compoundable" and core.startswith("compound") else
                                              "compounable" if word == "compoundable" else "bailable")
            j = 0
            while j < len(piece) and consumed < len(target):
                if piece[j].isalpha():
                    consumed += 1
                j += 1
            out.append(("Not " if neg else "") + (word if neg else word.capitalize()) + piece[j:])
        else:
            out.append(piece)
    return " / ".join(out)


def schedule_two_rows(pdf_path: str) -> List[str]:
    """Each offence in Schedule II as one plain sentence, with every "Ditto" replaced
    by the entry it repeats, so a reader cannot attach it to the wrong row."""
    import pdfplumber
    rows, prev, part_two, chapter, skipped = [], None, False, "", []
    with pdfplumber.open(pdf_path) as pdf:
        texts = [p.extract_text() or "" for p in pdf.pages]
        start = next(i for i, t in enumerate(texts) if re.search(r"(?m)^\W*\d*\s*SCHEDULE\s*[–-]\s*II\s*$", t))
        end = next(i for i, t in enumerate(texts) if i > start and re.search(r"(?m)^\W*\d*\[?SCHEDULE\s+III\b", t))
        for i in range(start, end + 1):
            for table in pdf.pages[i].extract_tables():
                for raw in table:
                    cells = [_cell(c) for c in raw]
                    filled = [c for c in cells if c]
                    if not filled:
                        continue
                    if len(filled) == 1:                      # a heading row
                        if re.search(r"OFFENCES AGAINST OTHER LAWS", filled[0], re.I):
                            part_two, chapter = True, "Offences against other laws"
                        elif re.search(r"CHAPTER", filled[0]):
                            chapter = filled[0].lstrip("_ ")
                        continue
                    if len(cells) > 8:                        # spacer columns that shift row to row
                        cells = filled if len(filled) == 8 else cells
                    if len(cells) != 8 or cells[0] in ("1", "2") or cells[1].lower().startswith("offence"):
                        if len(cells) != 8 and len(filled) > 2:
                            skipped.append(filled[0][:20])
                        continue
                    row = dict(zip(_SCHED_COLS, cells))
                    if row["offence"] in ("", "*") or row["section"].strip("* ") == "" and not prev:
                        continue                                # a row of omission marks
                    if prev:
                        for col in _SCHED_COLS[2:]:
                            row[col] = _resolve_ditto(row[col], prev[col])
                        if not row["section"]:
                            row["section"] = prev["section"]
                    row["section"] = re.sub(r"^\D*(?=\d)", "", row["section"])
                    row["section"] = re.sub(r"^(\d+)\s*-?\s*([A-Z]{1,2})\b", r"\1-\2", row["section"])
                    row["bailable"] = _canon(row["bailable"], "bailable")
                    row["compoundable"] = _canon(row["compoundable"], "compoundable")
                    row["court"] = re.sub(r"\s\d\s(?=[A-Z])", " ", row["court"])
                    row["punishment"] = re.sub(r"\b\d\s+(?=(?:one|two|three|four|five|seven|ten|fourteen|twenty|life|death|imprisonment|rigorous|simple)\b)", "", row["punishment"], flags=re.I)
                    row["chapter"], row["part_two"] = chapter, part_two
                    rows.append(row)
                    prev = row
    out = []
    for r in rows:
        if r["part_two"]:
            head = f"Offences against other laws — {r['section'] + ': ' if r['section'] and not r['section'][0].isdigit() else ''}{r['offence']}"
        else:
            head = f"PPC section {r['section']} — {r['offence']}"
        out.append(f"{head}. Arrest without warrant: {r['arrest']}. Warrant or summons: {r['process']}. "
                   f"Bailable: {r['bailable']}. Compoundable: {r['compoundable']}. Punishment: {r['punishment']}. "
                   f"Triable by: {r['court']}.")
    print(f"📋 Schedule II: {len(out)} offences read as a table (pages {start + 1}–{end + 1})"
          + (f"; rows not read: {skipped}" if skipped else ""))
    return out


def split_schedules(text: str) -> List[Tuple[str, str]]:
    """The schedules other than Schedule II, each as its own labelled part
    (Schedule II is read separately as a table)."""
    heads = list(re.finditer(r"(?m)^\W*\d*\[?\s*SCHEDULE\s*[–-]?\s*([IVX]+)\b", text))
    parts = []
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        if m.group(1) != "II":
            parts.append((f"Schedule {m.group(1)}", text[m.start():end].strip()))
    return parts


def schedule_two_parts(lines: List[str]) -> List[Tuple[str, str]]:
    intro = ("SCHEDULE II — TABULAR STATEMENT OF OFFENCES (Code of Criminal Procedure, 1898). For each offence: "
             "whether the police may arrest without warrant, whether a warrant or a summons ordinarily issues, "
             "whether it is bailable, whether it is compoundable, the punishment under the Pakistan Penal Code, "
             "and the court by which it is triable.")
    parts, cur = [], []
    def flush():
        if not cur:
            return
        secs = [re.match(r"PPC section (\S+)", l) for l in cur]
        secs = [m.group(1) for m in secs if m]
        label = (f"Schedule II — PPC sections {secs[0]}–{secs[-1]}" if len(set(secs)) > 1 else
                 f"Schedule II — PPC section {secs[0]}" if secs else "Schedule II — offences against other laws")
        parts.append((label, intro + "\n\n" + "\n".join(cur)))
    for line in lines:
        if cur and (sum(len(l) for l in cur) + len(line) > CHUNK_CHARS - 500
                    or (line.startswith("Offences against") != cur[-1].startswith("Offences against"))):
            flush(); cur = []
        cur.append(line)
    flush()
    return parts


def build_chunks(code: Dict, parts: List[Tuple[str, str]]) -> List[Dict]:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_CHARS, chunk_overlap=200,
                                              separators=["\n\n", "\n", "(?<=[.;:])\\s", " "], is_separator_regex=True)
    groups, cur, cur_len = [], [], 0
    for label, body in parts:
        if len(body) > CHUNK_CHARS:                       # a long section is split on its own
            if cur:
                groups.append(cur); cur, cur_len = [], 0
            pieces = splitter.split_text(body)
            for k, piece in enumerate(pieces):
                groups.append([(label, piece, f"part {k + 1} of {len(pieces)}")])
            continue
        if cur and cur_len + len(body) > CHUNK_CHARS:
            groups.append(cur); cur, cur_len = [], 0
        cur.append((label, body, None)); cur_len += len(body)
    if cur:
        groups.append(cur)

    def describe(group) -> str:
        labels = [g[0] for g in group]
        if not labels[0][0].isdigit():
            return labels[0] + (f" ({group[0][2]})" if group[0][2] else "")
        if len(group) == 1:
            return f"Section {labels[0]}" + (f" ({group[0][2]})" if group[0][2] else "")
        return f"Sections {labels[0]}–{labels[-1]}"

    chunks = []
    for i, group in enumerate(groups):
        where = describe(group)
        body = "\n\n".join(g[1] for g in group)
        chunks.append({
            "doc_type": "federal_law",
            "source_id": code["id"],
            "title": code["title"],
            "case_title": code["title"],
            "court": "Federal Legislature",
            "year": code["year"],
            "pdf_url": code["pdf_url"],
            "category": code["category"],
            "jurisdiction": "Federal",
            "law_no": f"{code['law_no']} of {code['year']}",
            "sections": where,
            "content": f"[LAW] {code['title']} | Federal Legislature | {code['year']}\n{code['abbr']} — {where}\n\n{body}",
            "chunk_index": i,
            "total_chunks": len(groups),
        })
    return chunks


# ── store ──────────────────────────────────────────────────────────────────
def store(code: Dict, chunks: List[Dict]) -> None:
    from qdrant_client.models import FieldCondition, Filter, MatchValue
    from backend.services.ingestion import ingestion_service
    from backend.services.qdrant import COLLECTION_NAME, qdrant_service
    client = qdrant_service.get_qdrant_client()
    client.delete(COLLECTION_NAME, points_selector=Filter(must=[
        FieldCondition(key="doc_type", match=MatchValue(value="federal_law")),
        FieldCondition(key="source_id", match=MatchValue(value=code["id"])),
    ]), wait=True)
    stored = 0
    for i in range(0, len(chunks), 32):
        stored += ingestion_service._upsert(client, chunks[i:i + 32])
    print(f"✅ {code['title']}: {stored} chunks stored")


def save_section_titles(code: Dict, contents: str, parts: List[Tuple[str, str]]) -> None:
    """Title and the opening words of every section: a title alone ("Procedure where
    Court considers…") can mislead; the opening words settle what a section is about."""
    titles = {}
    for m in re.finditer(r"(?m)^[ \t]*(\d{1,3})(?:[ -]?([A-Z]{1,3}))?\.[ \t]*(.+)$", contents):
        label = m.group(1) + (f"-{m.group(2)}" if m.group(2) else "")
        title = re.sub(r"\s+", " ", re.sub(r"\d+\[|\]|\[", "", m.group(3))).strip(" .")
        if int(m.group(1)) <= code["last_section"]:
            titles.setdefault(label, title)
    openings = {}
    for label, body in parts:
        if label[0].isdigit():
            body = re.sub(r"\d+\[|\]|\[|\*", " ", body)
            body = re.sub(r"\s+", " ", body)
            body = re.sub(r"^\s*\d{1,3}[ -]?[A-Z]{0,3}\.\s*", "", body)
            openings[label] = body[:320].rsplit(" ", 1)[0]
    data = {}
    if os.path.exists(TITLES_FILE):
        with open(TITLES_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
    data[code["abbr"]] = {"title": code["title"], "sections": titles, "openings": openings}
    with open(TITLES_FILE, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"🗂️  {code['title']}: {len(titles)} section titles saved")


def add_to_law_list(code: Dict) -> bool:
    with open(INDEX_FILE, encoding="utf-8") as fh:
        rows = [json.loads(l) for l in fh if l.strip()]
    if any(r.get("id") == code["id"] for r in rows):
        return False
    rows.append({"id": code["id"], "title": code["title"], "year": int(code["year"]), "category": code["category"],
                 "jurisdiction": "Federal", "law_no": code["law_no"], "pdf_url": code["pdf_url"],
                 "detail_url": code["detail_url"], "tags": code["tags"], "ingested_by": "ingest_core_codes.py"})
    with open(INDEX_FILE, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="download and chunk, but store nothing")
    ap.add_argument("--only", choices=[c["id"] for c in CODES], help="process one code")
    ap.add_argument("--titles-only", action="store_true", help="only refresh the section-title file")
    args = ap.parse_args()
    os.makedirs(CACHE_DIR, exist_ok=True)
    session, verify = _session()
    for code in CODES:
        if args.only and code["id"] != args.only:
            continue
        pdf_path = download(code, session, verify)
        contents, text = enacted_text(code, pdf_path)
        parts = split_sections(code, contents, text)
        save_section_titles(code, contents, parts)
        if args.titles_only:
            continue
        if code.get("schedule_two") and parts[-1][0] == "Schedules":
            parts = parts[:-1] + split_schedules(parts[-1][1]) + schedule_two_parts(schedule_two_rows(pdf_path))
        chunks = build_chunks(code, parts)
        sizes = [len(c["content"]) for c in chunks]
        print(f"🧩 {code['title']}: {len(chunks)} chunks (avg {sum(sizes) // len(sizes):,} chars, max {max(sizes):,})")
        if args.dry_run:
            for c in chunks[:2] + chunks[len(chunks) // 2: len(chunks) // 2 + 1]:
                print("   ---", c["sections"], "\n  ", c["content"][:300].replace("\n", "\n   "))
            continue
        store(code, chunks)
        if add_to_law_list(code):
            print(f"📚 {code['title']}: added to the Law library list")


if __name__ == "__main__":
    sys.path.insert(0, ROOT)
    main()
