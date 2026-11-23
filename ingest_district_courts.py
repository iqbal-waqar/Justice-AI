"""Add Punjab district-court judgments to the research corpus, one district at a time.

Every Punjab district court publishes its judgments on the same Lahore High Court
system (https://<district>.dc.lhc.gov.pk → Judgement & Orders). The PDFs there are
scanned pages, so this script reads them with OCR. Stages (each one resumable and
safe to re-run; finished work is skipped):

  fetch   page through every judge's judgments (posted and transferred judges) and
          download each PDF                                       → judgment.pdf
  ocr     read the scans with Tesseract (in parallel)             → text.txt
  meta    read each judgment's heading with the LLM: case number, case type,
          judgment or interim order, decision date                → metadata.json
  store   write <district>_cases.jsonl, split into passages, embed, and store in
          Qdrant as doc_type "district_case" (court "<District> District Courts")

Files are laid out like the high-court data (isb_data, sc_data):

  data/district_data/<district>/
      cases/<posted|transferred>_judges/<Judge_Name>/<Category>/<Year>/<date>_<Party_One>_VS_<Party_Two>_<id>/
          judgment.pdf   text.txt   metadata.json
      index.jsonl                  every downloaded judgment and its folder
      <district>_cases.jsonl       one record per stored judgment (metadata + text)

    python ingest_district_courts.py sahiwal --stage fetch --list-only   # count only
    python ingest_district_courts.py sahiwal                             # all stages
    python ingest_district_courts.py sahiwal --stage ocr --workers 8
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict, Iterator, List, Optional, Tuple

from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, ".env"))

DATA_ROOT = os.path.join(ROOT, "data", "district_data")
PAGE = "https://{d}.dc.lhc.gov.pk/PublicPages/JudgementOrder.aspx"
# The official names of the districts whose site address is shortened.
DISTRICT_NAMES = {"dgkhan": "Dera Ghazi Khan", "mbdin": "Mandi Bahauddin", "ttsingh": "Toba Tek Singh",
                  "nankana": "Nankana Sahib", "rahimyarkhan": "Rahim Yar Khan", "pakpattan": "Pakpattan",
                  "rajanpur": "Rajanpur", "bhakkar": "Bhakkar"}
GRID = "#MainContent_rgvJorders"
JUDGE_GROUPS = {"posted": "0", "transferred": "2"}


def district_name(slug: str) -> str:
    return DISTRICT_NAMES.get(slug, slug.replace("-", " ").title())


def paths(slug: str) -> Dict[str, str]:
    base = os.path.join(DATA_ROOT, slug)
    os.makedirs(base, exist_ok=True)
    return {"base": base, "index": os.path.join(base, "index.jsonl"),
            "records": os.path.join(base, f"{slug}_cases.jsonl")}


def _folder_name(text: str, limit: int = 60) -> str:
    return re.sub(r"[^A-Za-z0-9.\-]+", "_", text).strip("_.")[:limit].rstrip("_.") or "Unknown"


def case_folder(row: Dict) -> str:
    """cases/<group>_judges/<Judge>/<Category>/<Year>/<date>_<party one>_VS_<party two>_<id>,
    relative to the district folder."""
    d, m, y = (row["date"].split("/") + ["", "", ""])[:3] if "/" in row["date"] else ("", "", "Undated")
    date = f"{y}-{m}-{d}" if d else "undated"
    case = f"{date}_{_folder_name(row['party1'], 40)}_VS_{_folder_name(row['party2'], 40)}_{row['key'][:6]}"
    return "/".join(["cases", f"{row['judge_group']}_judges", _folder_name(row["judge"]),
                     _folder_name(row["category"]), y or "Undated", case])


def files(p: Dict[str, str], row: Dict) -> Dict[str, str]:
    folder = os.path.join(p["base"], row["folder"])
    return {"dir": folder, "pdf": os.path.join(folder, "judgment.pdf"), "text": os.path.join(folder, "text.txt"),
            "meta": os.path.join(folder, "metadata.json")}


def read_jsonl(path: str) -> List[Dict]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def append_jsonl(path: str, row: Dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


# ── fetch ─────────────────────────────────────────────────────────────────────

class Site:
    """The district's Judgement & Orders page (an ASP.NET / Telerik form)."""

    def __init__(self, slug: str, delay: float = 0.3):
        import requests
        self.url = PAGE.format(d=slug)
        self.s = requests.Session()
        self.s.headers["User-Agent"] = "Mozilla/5.0 (JusticeAI research corpus)"
        self.delay = delay

    def _req(self, method: str, **kw):
        for attempt in range(4):
            try:
                r = self.s.request(method, self.url, timeout=120, **kw)
                r.raise_for_status()
                time.sleep(self.delay)
                return r
            except Exception as exc:
                if attempt == 3:
                    raise
                print(f"   ↻ retry after {exc.__class__.__name__}")
                time.sleep(5 * (attempt + 1))

    @staticmethod
    def combo(html: str, name: str) -> List[Tuple[str, str]]:
        from bs4 import BeautifulSoup
        m = re.search(r'"_uniqueId":"ctl00\$MainContent\$%s".*?"itemData":' % name, html, re.S)
        values = json.JSONDecoder().raw_decode(html, m.end())[0] if m else []
        texts = [li.get_text(strip=True) for li in BeautifulSoup(html, "html.parser").select(f"#MainContent_{name}_DropDown li")]
        return [(v.get("value"), t) for v, t in zip(values, texts) if v.get("value")]

    @staticmethod
    def form(html: str, group: str) -> Dict[str, str]:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        f = {i["name"]: i.get("value", "") for i in soup.select("input[name]")
             if i.get("type") not in ("submit", "radio", "checkbox")}
        f["ctl00$MainContent$rbJudge"] = group
        return f

    @staticmethod
    def _judge_state(value: str, text: str) -> Dict[str, str]:
        return {"ctl00$MainContent$ddlJudge": text, "MainContent_ddlJudge_ClientState": json.dumps(
            {"logEntries": [], "value": value, "text": text, "enabled": True, "checkedIndices": [],
             "checkedItemsTextOverflows": False})}

    def judges(self, group: str) -> Tuple[str, List[Tuple[str, str]]]:
        html = self._req("GET").text
        if group != "0":
            f = self.form(html, group)
            f["__EVENTTARGET"] = "ctl00$MainContent$rbJudge$1"
            html = self._req("POST", data=f).text
        return html, self.combo(html, "ddlJudge")

    def judgment_pages(self, start_html: str, group: str, judge: Tuple[str, str]) -> Iterator[Tuple[str, List[Dict], int]]:
        """Yield (page html, rows, total) for every results page of one judge."""
        from bs4 import BeautifulSoup
        state = self._judge_state(*judge)
        f = self.form(start_html, group)
        f.update(state, __EVENTTARGET="ctl00$MainContent$ddlJudge")
        html = self._req("POST", data=f).text
        f = self.form(html, group)
        f.update(state, **{"ctl00$MainContent$btnSearch": "Search"})
        html = self._req("POST", data=f).text
        seen = 0
        while True:
            soup = BeautifulSoup(html, "html.parser")
            info = soup.select_one(".rgInfoPart")
            total = int(re.search(r"(\d+) items", info.get_text())[1]) if info else None
            rows = []
            for tr in soup.select(f"{GRID} tr.rgRow, {GRID} tr.rgAltRow"):
                # cells: SN, (summary cell), party one, party two, category, date, download, tagline
                tds = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
                a = tr.find("a", href=re.compile("lbPDF"))
                if not a or len(tds) < 7:
                    continue
                rows.append({"party1": tds[2], "party2": tds[3], "category": tds[4], "date": tds[5],
                             "tagline": re.sub(r"^Tagline\s*:\s*", "", tds[-1]) if tds[-1].startswith("Tagline") else "",
                             "target": re.search(r"__doPostBack\('([^']+)'", a["href"]).group(1)})
            total = total if total is not None else len(rows)
            yield html, rows, total
            seen += len(rows)
            if not rows or seen >= total:
                return
            # The grid's "next" arrow does not page on this site; its page-number links do.
            current = soup.select_one(f"{GRID} .rgNumPart a.rgCurrentPage")
            nxt = current.find_next_sibling("a") if current else None
            target = re.search(r"__doPostBack\('([^']+)'", nxt.get("href", "")) if nxt else None
            if not target:
                return
            f = self.form(html, group)
            f.update(state, __EVENTTARGET=target.group(1), __EVENTARGUMENT="")
            html = self._req("POST", data=f).text

    def download(self, page_html: str, group: str, judge: Tuple[str, str], target: str) -> Optional[bytes]:
        f = self.form(page_html, group)
        f.update(self._judge_state(*judge), __EVENTTARGET=target, __EVENTARGUMENT="")
        r = self._req("POST", data=f)
        return r.content if r.content[:4] == b"%PDF" else None


def judgment_key(slug: str, judge_id: str, row: Dict) -> str:
    raw = "|".join([slug, judge_id, row["party1"], row["party2"], row["category"], row["date"], row["tagline"]])
    return hashlib.sha1(raw.lower().encode()).hexdigest()[:16]


def stage_fetch(slug: str, groups: List[str], list_only: bool, since: Optional[datetime],
                limit: Optional[int] = None, per_judge: Optional[int] = None) -> None:
    """limit: stop after this many new downloads; per_judge: take at most this many of
    each judge's newest judgments (spreads a small sample across all the courts)."""
    p = paths(slug)
    index = {r["key"]: r for r in read_jsonl(p["index"])}
    site = Site(slug)
    grand = downloaded = 0
    for group_name in groups:
        if limit and downloaded >= limit:
            break
        group = JUDGE_GROUPS[group_name]
        start_html, judges = site.judges(group)
        print(f"👩‍⚖️ {district_name(slug)}: {len(judges)} {group_name} judges")
        for judge in judges:
            if limit and downloaded >= limit:
                break
            judge_id, judge_text = judge
            got = new = 0
            try:
                for html, rows, total in site.judgment_pages(start_html, group, judge):
                    if list_only:
                        got = total
                        break
                    dates = [datetime.strptime(r["date"], "%d/%m/%Y") for r in rows
                             if re.fullmatch(r"\d\d/\d\d/\d{4}", r["date"])]
                    full = False
                    for row in rows:
                        if (per_judge and got >= per_judge) or (limit and downloaded >= limit):
                            full = True
                            break
                        got += 1
                        when = datetime.strptime(row["date"], "%d/%m/%Y") if re.fullmatch(r"\d\d/\d\d/\d{4}", row["date"]) else None
                        if since and when and when < since:
                            continue
                        key = judgment_key(slug, judge_id, row)
                        if key in index and os.path.exists(files(p, index[key])["pdf"]):
                            continue
                        content = site.download(html, group, judge, row["target"])
                        if not content:
                            print(f"   ⚠️ no PDF for {row['party1']} v {row['party2']} ({row['date']})")
                            continue
                        if key not in index:
                            judge_name, _, designation = judge_text.partition(",")
                            entry = {"key": key, "district": slug, "judge_id": judge_id, "judge": judge_name.strip(),
                                     "designation": designation.strip(), "judge_group": group_name,
                                     **{k: v for k, v in row.items() if k != "target"}}
                            entry["folder"] = case_folder(entry)
                            append_jsonl(p["index"], entry)
                            index[key] = entry
                        f = files(p, index[key])
                        os.makedirs(f["dir"], exist_ok=True)
                        with open(f["pdf"], "wb") as fh:
                            fh.write(content)
                        new += 1
                        downloaded += 1
                    if full:
                        break
                    if since and dates and max(dates) < since:
                        break          # the site lists newest first: the rest is older
            except Exception as exc:
                print(f"   ⚠️ {judge_text}: stopped ({exc.__class__.__name__}: {exc}) — re-run to continue")
                site = Site(slug)
                start_html, _ = site.judges(group)
            grand += got
            print(f"   {got:5d} judgments  {'' if list_only else f'({new} new)  '}{judge_text}")
    print(f"📊 {district_name(slug)}: {grand} judgments listed; {len(index)} downloaded in total")


# ── ocr ───────────────────────────────────────────────────────────────────────

def _letters_ratio(line: str) -> float:
    chars = [c for c in line if not c.isspace()]
    return sum(c.isalpha() for c in chars) / len(chars) if chars else 0.0


def clean_ocr(text: str) -> str:
    """Drop scanner noise (stamps, margin marks, signature scribbles) that OCR turns
    into short runs of stray characters; keep every line that reads as text."""
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            if out and out[-1]:
                out.append("")
            continue
        words = re.findall(r"[A-Za-z]{2,}", s)
        if len(s) < 6 and not re.fullmatch(r"\d{1,3}[.)]?", s):
            continue
        if _letters_ratio(s) < 0.55 or not words:
            continue
        s = re.sub(r"^(?:[^\w(\"“]{1,3}\s+|[a-z]{1,2}\s+(?=[A-Z]))", "", s)   # stray marks before the text
        out.append(s)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def english_share(text: str) -> float:
    words = re.findall(r"[A-Za-z]+", text)
    if not words:
        return 0.0
    common = {"the", "of", "and", "to", "in", "is", "that", "for", "by", "was", "on", "has", "with", "as",
              "be", "are", "this", "from", "learned", "court", "case", "petitioner", "respondent", "accused"}
    return sum(w.lower() in common for w in words) / len(words)


def ocr_one(pdf: str, out: str) -> Tuple[str, int, int]:
    env = dict(os.environ, OMP_THREAD_LIMIT="1")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "300", "-gray", "-png", pdf, os.path.join(tmp, "p")],
                       check=True, capture_output=True, timeout=600)
        pages = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        texts = []
        for f in pages:
            r = subprocess.run(["tesseract", os.path.join(tmp, f), "stdout", "--psm", "6", "-l", "eng"],
                               capture_output=True, text=True, env=env, timeout=300)
            texts.append(clean_ocr(r.stdout))
    text = "\n\n".join(t for t in texts if t)
    with open(out + ".part", "w", encoding="utf-8") as fh:
        fh.write(text)
    os.replace(out + ".part", out)
    return os.path.basename(pdf), len(pages), len(text)


def stage_ocr(slug: str, workers: int) -> None:
    p = paths(slug)
    todo = []
    for row in read_jsonl(p["index"]):
        f = files(p, row)
        if os.path.exists(f["pdf"]) and not os.path.exists(f["text"]):
            todo.append((f["pdf"], f["text"]))
    print(f"🔎 OCR: {len(todo)} judgments to read with {workers} workers")
    done = pages = 0
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(ocr_one, pdf, out) for pdf, out in todo]
        for fut in as_completed(futures):
            try:
                _, n, _ = fut.result()
                done += 1
                pages += n
            except Exception as exc:
                print(f"   ⚠️ OCR failed: {exc}")
            if done and done % 25 == 0:
                rate = pages / (time.time() - t0)
                print(f"   {done}/{len(todo)} judgments, {pages} pages ({rate:.1f} pages/s)")
    print(f"✅ OCR finished: {done} judgments, {pages} pages")


# ── meta ──────────────────────────────────────────────────────────────────────

META_SYSTEM = """You read the opening of a Pakistani district-court judgment or order (OCR of a scanned page; expect some OCR errors) and return its particulars exactly as written.
- case_number: the case's number as written, e.g. "Family Appeal No. 49 of 2026", "Civil Suit No. 1234 of 2021". A criminal trial with no case number is identified by its FIR: "FIR No. 120/2024, PS Yousafwala, u/s 302 PPC". Correct obvious OCR errors only. Never use the listing's category ("Criminal Cases", "Civil Appeals") as the number; empty if the document gives neither a number nor an FIR.
- case_type: the kind of case in a few words, e.g. "Family appeal", "Civil suit for declaration", "Bail application", "Criminal trial (murder)".
- decision_date: the date of decision as YYYY-MM-DD, empty if not stated.
- presiding_officer: the judge who decided it, with designation, e.g. "Muhammad Faisal Ahmad, District Judge, Sahiwal".
- document_kind: "judgment" when it finally decides the case, appeal, revision, petition or application on its merits (including bail decisions); "order" for an interim or procedural order (adjournment, notice, interim injunction pending decision, etc.).
- readable: false when the text is too garbled or not English, so its substance cannot be followed."""


def _meta_model():
    from typing import Literal
    from pydantic import BaseModel

    class JudgmentParticulars(BaseModel):
        case_number: str
        case_type: str
        decision_date: str
        presiding_officer: str
        document_kind: Literal["judgment", "order"]
        readable: bool
    return JudgmentParticulars


def stage_meta(slug: str, workers: int) -> None:
    from backend.services.llm import llm_service
    p = paths(slug)
    index = {r["key"]: r for r in read_jsonl(p["index"])}
    todo = [k for k, r in index.items() if os.path.exists(files(p, r)["text"]) and not os.path.exists(files(p, r)["meta"])]
    print(f"🧾 Reading particulars of {len(todo)} judgments")
    llm = llm_service._build(model=os.getenv("OPENAI_ASSESS_MODEL") or os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
                             temperature=0, max_tokens=300, timeout=60, max_retries=3)
    reader = llm.with_structured_output(_meta_model(), method="json_schema", strict=True)

    def one(key: str) -> Dict:
        row = index[key]
        text = open(files(p, row)["text"], encoding="utf-8").read()
        if len(text) < 300 or english_share(text) < 0.08:
            return {"key": key, "readable": False, "chars": len(text)}
        hint = f"Listed on the court's site as: {row['party1']} v. {row['party2']}, {row['category']}, {row['date']}, {row['judge']} {row['designation']}"
        got = reader.invoke([("system", META_SYSTEM), ("human", f"{hint}\n\nOPENING OF THE DOCUMENT:\n{text[:5000]}")])
        return {"key": key, "chars": len(text), **got.model_dump()}

    n = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for fut in as_completed([pool.submit(one, k) for k in todo]):
            try:
                got = fut.result()
                write_metadata(p, index[got["key"]], got)
                n += 1
                if n % 100 == 0:
                    print(f"   {n}/{len(todo)}")
            except Exception as exc:
                print(f"   ⚠️ {exc.__class__.__name__}: {exc}")
    print(f"✅ Particulars read for {n} judgments")


# ── store ─────────────────────────────────────────────────────────────────────

def _decision_date(meta: Dict, row: Dict) -> str:
    if re.fullmatch(r"\d{4}-\d\d-\d\d", meta.get("decision_date") or ""):
        return meta["decision_date"]
    if re.fullmatch(r"\d\d/\d\d/\d{4}", row.get("date") or ""):
        d, m, y = row["date"].split("/")
        return f"{y}-{m}-{d}"
    return ""


def pdf_url(path: str) -> str:
    """The judgment PDF as served by the backend (/data is mounted as static files): the
    district sites have no direct PDF links, only a download button inside their search form."""
    from urllib.parse import quote
    return "/" + quote(os.path.relpath(path, ROOT).replace(os.sep, "/"))


def write_metadata(p: Dict[str, str], row: Dict, meta: Dict) -> None:
    """metadata.json in the judgment's folder: the court's listing plus what was read from the judgment."""
    slug = row["district"]
    date = _decision_date(meta, row)
    doc = {
        "court": f"{district_name(slug)} District Courts", "district": district_name(slug),
        "case_number": meta.get("case_number", ""), "case_title": f"{row['party1']} v. {row['party2']}",
        "petitioner": row["party1"], "respondent": row["party2"],
        "judge": row["judge"], "designation": row["designation"], "judge_group": row["judge_group"],
        "presiding_officer": meta.get("presiding_officer", ""),
        "category": row["category"], "case_type": meta.get("case_type", ""),
        "document_kind": meta.get("document_kind", ""), "readable": bool(meta.get("readable")),
        "decision_date": date, "year": date[:4], "listed_date": row["date"],
        "source_url": PAGE.format(d=slug), "pdf_url": pdf_url(files(p, row)["pdf"]),
        "key": row["key"], "text_chars": meta.get("chars", 0),
    }
    with open(files(p, row)["meta"], "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)


def stage_store(slug: str, include_orders: bool) -> None:
    from backend.services.ingestion import build_chunks, ingestion_service
    from backend.services.qdrant import qdrant_service
    p = paths(slug)
    court = f"{district_name(slug)} District Courts"
    client = qdrant_service.get_qdrant_client()
    pending, stored, docs, skipped = [], 0, 0, {"unreadable": 0, "order": 0}
    records = open(p["records"] + ".part", "w", encoding="utf-8")
    for row in read_jsonl(p["index"]):
        f = files(p, row)
        if not os.path.exists(f["meta"]):
            continue
        meta = json.load(open(f["meta"], encoding="utf-8"))
        key = row["key"]
        if not meta.get("readable"):
            skipped["unreadable"] += 1
            continue
        if meta.get("document_kind") == "order" and not include_orders:
            skipped["order"] += 1
            continue
        text = open(f["text"], encoding="utf-8").read()
        date = meta.get("decision_date", "")
        title = meta["case_title"]
        officer = meta.get("presiding_officer") or f"{row['judge']}, {row['designation']}".strip(", ")
        heading = "\n".join(x for x in [
            f"{court.upper()} — {'JUDGMENT' if meta.get('document_kind') == 'judgment' else 'ORDER'}",
            f"Case: {meta['case_number']}" if meta.get("case_number") else "", f"Type: {meta.get('case_type') or row['category']}",
            f"Presiding officer: {officer}", f"Decided: {date}" if date else ""] if x)
        record = {
            "case_title": title, "case_number": meta.get("case_number") or "", "court": court,
            "year": date[:4], "decision_date": date, "judge": officer, "petitioner": row["party1"],
            "respondent": row["party2"], "category": meta.get("case_type") or row["category"],
            "pdf_url": pdf_url(f["pdf"]),
            "text_content": f"{heading}\n\n{text}",
        }
        records.write(json.dumps({**meta, **record}, ensure_ascii=False) + "\n")
        chunks = build_chunks(record, "district_case")
        for c in chunks:
            c["source_id"] = f"{slug}:{key}"
            c["district"] = district_name(slug)
            if not meta.get("case_number"):
                c.pop("case_number", None)        # no number in the judgment: show the parties only
        pending.extend(chunks)
        docs += 1
        while len(pending) >= 64:
            stored += ingestion_service._upsert(client, pending[:64], skip_existing=True)
            pending = pending[64:]
    if pending:
        stored += ingestion_service._upsert(client, pending, skip_existing=True)
    records.close()
    os.replace(p["records"] + ".part", p["records"])
    print(f"✅ {court}: {docs} judgments → {stored} new passages stored "
          f"(skipped {skipped['unreadable']} unreadable, {skipped['order']} interim orders)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("district", help="the site name, e.g. sahiwal, lahore, mbdin")
    ap.add_argument("--stage", choices=["fetch", "ocr", "meta", "store", "all"], default="all")
    ap.add_argument("--judges", choices=["posted", "transferred", "both"], default="both")
    ap.add_argument("--since", help="only judgments dated on/after YYYY-MM-DD")
    ap.add_argument("--list-only", action="store_true", help="fetch: count judgments, download nothing")
    ap.add_argument("--limit", type=int, help="fetch: stop after this many new downloads")
    ap.add_argument("--per-judge", type=int, help="fetch: at most this many of each judge's newest judgments")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 2))
    ap.add_argument("--include-orders", action="store_true", help="store: also index interim orders")
    a = ap.parse_args()
    groups = ["posted", "transferred"] if a.judges == "both" else [a.judges]
    since = datetime.strptime(a.since, "%Y-%m-%d") if a.since else None
    if a.stage in ("fetch", "all"):
        stage_fetch(a.district, groups, a.list_only, since, a.limit, a.per_judge)
        if a.list_only:
            return
    if a.stage in ("ocr", "all"):
        stage_ocr(a.district, a.workers)
    if a.stage in ("meta", "all"):
        stage_meta(a.district, min(8, a.workers))
    if a.stage in ("store", "all"):
        stage_store(a.district, a.include_orders)


if __name__ == "__main__":
    main()
