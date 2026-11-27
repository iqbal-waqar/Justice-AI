"""Case auto-fill from the courts' public case-status websites.

Type a case number, pick the court, and the case form fills itself. Two sources:

  * Punjab District Judiciary case management system (dsj.punjab.gov.pk) —
    every district court in Punjab. Lookup by CMS case number or by FIR; the
    judges sitting in a district and a judge's daily cause list so a lawyer who
    only knows the judge and the date can tap the case. The site guards its
    forms with an arithmetic question ("What is 4 + 9") which is solved here.
  * Lahore High Court case status (data.lhc.gov.pk) — lookup by case number and
    bench. No captcha, but the server is slow (40–90 s).

Both are HTML pages, not APIs, so every adapter parses by column heading and
returns one normalized record; a layout change on a court site breaks only that
adapter and is logged. Results are cached for a short while per query.
"""
import logging
import re
import threading
import time
from datetime import date, datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from fastapi import HTTPException

log = logging.getLogger("court_lookup")

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) JusticeAI case auto-fill"}
DSJ = "https://dsj.punjab.gov.pk/"
LHC_STATUS = "https://data.lhc.gov.pk/dynamic/case_status_result.php"
CACHE_TTL = 3 * 60 * 60           # a fetched record is good for a few hours
PORTAL_TIMEOUT = 60
LHC_TIMEOUT = 150

# District ids as the Punjab portal numbers them (its own <select name="district_id">).
DISTRICTS: Dict[str, int] = {
    "Attock": 1, "Bahawalnagar": 2, "Bahawalpur": 3, "Bhakkar": 4, "Chakwal": 5, "Chiniot": 6, "D.G.Khan": 7,
    "Faisalabad": 8, "Gujranwala": 9, "Gujrat": 10, "Hafizabad": 11, "Jhang": 12, "Jhelum": 13, "Kasur": 14,
    "Khanewal": 15, "Khushab": 16, "Lahore": 17, "Layyah": 18, "Lodhran": 19, "M.B.Din": 20, "Mianwali": 21,
    "Multan": 22, "Muzaffargarh": 23, "Nankana Sahib": 24, "Narowal": 25, "Okara": 26, "Pakpattan": 27,
    "R.Y.Khan": 28, "Rajanpur": 29, "Rawalpindi": 30, "Sahiwal": 31, "Sargodha": 32, "Sheikhupura": 33,
    "Sialkot": 34, "T.T.Singh": 35, "Vehari": 36,
}
LHC_BENCHES = {"L": "Lahore", "R": "Rawalpindi", "M": "Multan", "B": "Bahawalpur"}

_cache: Dict[str, tuple] = {}
_cache_lock = threading.Lock()


def _cached(key: str, make):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
    value = make()
    with _cache_lock:
        _cache[key] = (now + CACHE_TTL, value)
    return value


def _clean(text: str) -> str:
    return " ".join((text or "").replace("‌", " ").split())


def _parse_date(text: str) -> Optional[str]:
    """'27-10-2026', '21.11.2026', '2026-11-27' → ISO date, else None."""
    text = _clean(text)
    for fmt in ("%d-%m-%Y", "%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _rows(table) -> List[List[str]]:
    return [[_clean(td.get_text(" ")) for td in tr.find_all(["th", "td"])] for tr in table.select("tr")]


def _split_title(title: str) -> dict:
    m = re.split(r"\s+(?:VS|Vs|vs|V/S|v\.|بنام)\s+", title, maxsplit=1)
    return {"petitioner": m[0].strip() if m else title, "respondent": m[1].strip() if len(m) > 1 else ""}


def district_name(district_id: int) -> str:
    return next((n for n, i in DISTRICTS.items() if i == district_id), str(district_id))


def _record(**kw) -> dict:
    base = {
        "source": None, "source_url": None, "case_number": None, "title": None, "title_urdu": None,
        "petitioner": None, "respondent": None, "court": None, "district": None, "bench": None, "judge": None,
        "category": None, "status": None, "stage": None, "institution_number": None, "filed_on": None,
        "last_hearing": None, "next_hearing": None, "decided_on": None, "decision": None, "short_order": None,
        "fir_number": None, "fir_year": None, "police_station": None, "offence": None, "proceedings": [],
    }
    base.update({k: v for k, v in kw.items() if v not in (None, "")})
    return base


class PunjabDistrictPortal:
    """dsj.punjab.gov.pk — Case Management System, District Judiciary Punjab."""

    def _session(self) -> tuple:
        s = requests.Session()
        s.headers.update(UA)
        try:
            home = s.get(DSJ, timeout=PORTAL_TIMEOUT)
            home.raise_for_status()
        except requests.RequestException as exc:
            log.warning("district portal unreachable: %s", exc.__class__.__name__)
            raise HTTPException(status_code=503, detail="The district court portal is not responding. Try again in a minute or enter the details manually.")
        soup = BeautifulSoup(home.text, "html.parser")
        answers = {}
        for form_id in ("frm_search", "frm_causelist"):
            form = soup.select_one(f"#{form_id}")
            m = re.search(r"What is\s*(\d+)\s*\+\s*(\d+)", form.get_text(" ")) if form else None
            if not m:
                log.error("district portal: captcha text not found for %s", form_id)
                raise HTTPException(status_code=502, detail="The district court portal has changed its page and could not be read.")
            answers[form_id] = int(m.group(1)) + int(m.group(2))
        return s, answers

    # ── reference lists ──
    def judges(self, district_id: int) -> List[dict]:
        def make():
            try:
                r = requests.get(urljoin(DSJ, f"getjudges/{district_id}/0"), headers=UA, timeout=PORTAL_TIMEOUT)
                r.raise_for_status()
                return [{"court_id": int(j["court_id"]), "name": _clean(j["j_name_eng"])} for j in r.json()]
            except (requests.RequestException, ValueError, KeyError) as exc:
                log.warning("district portal judges failed: %s", exc.__class__.__name__)
                raise HTTPException(status_code=503, detail="Could not load the judges of this district from the court portal.")
        return _cached(f"dsj:judges:{district_id}", make)

    def police_stations(self, district_id: int) -> List[dict]:
        def make():
            try:
                r = requests.get(urljoin(DSJ, f"getpolicestations/{district_id}"), headers=UA, timeout=PORTAL_TIMEOUT)
                r.raise_for_status()
                return [{"id": int(p["id"]), "name": _clean(p["ps_name_eng"])} for p in r.json()]
            except (requests.RequestException, ValueError, KeyError) as exc:
                log.warning("district portal police stations failed: %s", exc.__class__.__name__)
                raise HTTPException(status_code=503, detail="Could not load the police stations of this district from the court portal.")
        return _cached(f"dsj:ps:{district_id}", make)

    # ── search ──
    def _search(self, district_id: int, case_no: str = "", fir_no: str = "", fir_year: str = "", ps_id: str = "") -> List[dict]:
        s, cap = self._session()
        params = {"district_id": district_id, "case_no": case_no, "fir_no": fir_no, "fir_year": fir_year,
                  "policestation_id": ps_id, "confirmCaptcha": cap["frm_search"]}
        try:
            r = s.get(urljoin(DSJ, "search"), params=params, timeout=PORTAL_TIMEOUT)
            r.raise_for_status()
        except requests.RequestException as exc:
            log.warning("district portal search failed: %s", exc.__class__.__name__)
            raise HTTPException(status_code=503, detail="The district court portal did not answer the search. Try again in a minute.")
        soup = BeautifulSoup(r.text, "html.parser")
        table = soup.select_one("#dt_casesearch") or soup.select_one("table")
        out = []
        if not table:
            return out
        for tr in table.select("tbody tr"):
            tds = tr.find_all("td")
            if len(tds) < 6:
                continue
            link = tds[1].find("a")
            cat_lines = [_clean(x) for x in tds[2].stripped_strings]
            judge_small = tds[3].find("div")
            judge_name = _clean(tds[3].get_text(" ").replace(judge_small.get_text(" "), "")) if judge_small else _clean(tds[3].get_text(" "))
            labels = [_clean(d.get_text()) for d in tds[4].select(".label")] or [_clean(tds[4].get_text(" "))]
            out.append({
                "case_number": _clean(tds[0].get_text()),
                "title": _clean(tds[1].get_text(" ")),
                "detail_url": link["href"] if link and link.has_attr("href") else None,
                "category": cat_lines[0] if cat_lines else None,
                "fir": " ".join(cat_lines[1:]) if len(cat_lines) > 1 else None,
                "judge": judge_name,
                "judge_designation": _clean(judge_small.get_text(" ")) if judge_small else None,
                "status": labels[0] if labels else None,
                "stage": labels[1] if len(labels) > 1 else None,
                "date": _parse_date(tds[5].get_text()),
                "district": district_name(district_id),
            })
        return out

    def by_case_number(self, district_id: int, case_number: str) -> Optional[dict]:
        case_number = re.sub(r"\D", "", case_number or "")
        if len(case_number) < 3:
            raise HTTPException(status_code=400, detail="Enter the CMS case number printed on the court file (digits only).")

        def make():
            hits = self._search(district_id, case_no=case_number)
            exact = [h for h in hits if h["case_number"] == case_number] or hits
            if not exact:
                return None
            return self.detail(exact[0]["detail_url"], exact[0])
        return _cached(f"dsj:case:{district_id}:{case_number}", make)

    def by_fir(self, district_id: int, fir_number: str, fir_year: str, police_station_id: Optional[int]) -> List[dict]:
        # Lawyers write an FIR as "250/2025" or "250/25" — take the number, and the year from it when given.
        m = re.fullmatch(r"\s*(\d+)\s*(?:/\s*(\d{2}|\d{4}))?\s*", fir_number or "")
        if not m:
            raise HTTPException(status_code=400, detail="Enter the FIR number as digits, for example 250 or 250/2025.")
        fir_number = m.group(1)
        if m.group(2):
            fir_year = m.group(2) if len(m.group(2)) == 4 else f"20{m.group(2)}"
        fir_year = _clean(fir_year or "")
        if not re.fullmatch(r"\d{4}", fir_year):
            raise HTTPException(status_code=400, detail="Enter the FIR number and its four-digit year.")
        key = f"dsj:fir:{district_id}:{fir_number}:{fir_year}:{police_station_id or ''}"
        return _cached(key, lambda: self._search(district_id, fir_no=fir_number, fir_year=fir_year, ps_id=str(police_station_id or "")))

    def detail(self, url: Optional[str], summary: dict) -> dict:
        rec = _record(source="punjab_district_portal", source_url=url, case_number=summary.get("case_number"),
                      title=summary.get("title"), judge=summary.get("judge"), category=summary.get("category"),
                      status=summary.get("status"), stage=summary.get("stage"), district=summary.get("district"),
                      court=f"{summary.get('district')} District Courts" if summary.get("district") else None,
                      **_split_title(summary.get("title") or ""))
        if summary.get("judge_designation"):
            rec["judge"] = f"{summary['judge']}, {summary['judge_designation']}"
        if not url:
            return rec
        try:
            r = requests.get(url, headers=UA, timeout=PORTAL_TIMEOUT)
            r.raise_for_status()
        except requests.RequestException as exc:
            log.warning("district portal detail failed: %s", exc.__class__.__name__)
            return rec
        soup = BeautifulSoup(r.text, "html.parser")
        h3 = soup.select_one("h3.case-title")
        if h3:
            urdu = h3.select_one("span")
            rec["title_urdu"] = _clean(urdu.get_text(" ")) if urdu else None
            if urdu:
                urdu.extract()
            rec["title"] = _clean(h3.get_text(" ")) or rec["title"]
            rec.update(_split_title(rec["title"]))
        tables = soup.select("table")
        if tables:
            rows = _rows(tables[0])
            kv = {}
            for i in range(0, len(rows) - 1, 2):
                kv.update(dict(zip(rows[i], rows[i + 1])))
            rec["status"] = kv.get("Case Status") or rec["status"]
            rec["case_number"] = kv.get("Case No.") or rec["case_number"]
            rec["category"] = kv.get("Case Category") or rec["category"]
            inst = kv.get("Institution No. & Date", "")
            if "/" in inst:
                num, _, dt = inst.partition("/")
                rec["institution_number"] = num.strip() if num.strip() not in ("", "0") else None
                rec["filed_on"] = _parse_date(dt)
            rec["fir_number"] = kv.get("FIR No") or None
            rec["fir_year"] = kv.get("FIR Year") or None
            rec["police_station"] = kv.get("Police Station") or None
            rec["offence"] = kv.get("Offence") or None
        for h4 in soup.select("h4"):
            label = _clean(h4.get_text())
            table = h4.find_next("table")
            if not table:
                continue
            rows = _rows(table)
            if label.startswith("Disposal") and len(rows) >= 2:
                head, val = rows[0], rows[1]
                kv = dict(zip(head, val))
                rec["judge"] = kv.get("Decided By") or rec["judge"]
                rec["decided_on"] = _parse_date(kv.get("Decision Date", ""))
                rec["decision"] = kv.get("Decision Type") or None
                for row in rows[2:]:
                    if row and row[0].startswith("Short Order"):
                        rec["short_order"] = _clean(row[0].split("::", 1)[-1]) or None
            elif label.startswith("Proceeding"):
                judge_row = table.select_one("h5")
                if judge_row and not rec.get("judge"):
                    rec["judge"] = _clean(judge_row.get_text())
                procs = []
                for row in rows:
                    if len(row) >= 3 and re.fullmatch(r"\d+", row[0]):
                        procs.append({"date": _parse_date(row[1]), "stage": row[2], "order": row[3] if len(row) > 3 else ""})
                procs = [p for p in procs if p["date"]]
                rec["proceedings"] = sorted(procs, key=lambda p: p["date"])
                if procs:
                    rec["last_hearing"] = rec["proceedings"][-1]["date"]
                    if not rec["stage"]:
                        rec["stage"] = rec["proceedings"][-1]["stage"]
        if rec["status"] and rec["status"].lower().startswith("pending") and summary.get("date"):
            rec["next_hearing"] = summary["date"]
        return rec

    # ── cause list ──
    def cause_list(self, district_id: int, court_id: int, on: date) -> dict:
        key = f"dsj:clist:{district_id}:{court_id}:{on.isoformat()}"

        def make():
            s, cap = self._session()
            params = {"clist_cid": court_id, "clist_dated": on.strftime("%d-%m-%Y"), "district": district_id,
                      "confirmCaptchaCList": cap["frm_causelist"]}
            try:
                r = s.get(urljoin(DSJ, "causelist"), params=params, timeout=PORTAL_TIMEOUT)
                r.raise_for_status()
            except requests.RequestException as exc:
                log.warning("district portal cause list failed: %s", exc.__class__.__name__)
                raise HTTPException(status_code=503, detail="The district court portal did not return the cause list. Try again in a minute.")
            soup = BeautifulSoup(r.text, "html.parser")
            heading = " · ".join(_clean(h.get_text(" ")) for h in soup.select("h3, h4")[:2])
            cases = []
            for table in soup.select("table"):
                rows = _rows(table)
                # Urdu heading row, right-to-left columns: sr, case no, last date, FIR/PS, offence, title, today's, next date, next stage
                for row in rows:
                    cells = [c for c in row]
                    if len(cells) < 8:
                        continue
                    cells = cells[::-1]       # left-most printed cell is the serial number once reversed
                    if not re.fullmatch(r"\d+", cells[0]):
                        continue
                    cases.append({
                        "serial": int(cells[0]), "case_number": cells[1], "last_hearing": _parse_date(cells[2]),
                        "fir": cells[3], "offence": cells[4], "title": cells[5], "today": cells[6] if len(cells) > 6 else "",
                        "next_hearing": _parse_date(cells[7]) if len(cells) > 7 else None,
                        "next_stage": cells[8] if len(cells) > 8 else "",
                    })
            judge = next((j["name"] for j in self.judges(district_id) if j["court_id"] == court_id), None)
            return {"district": district_name(district_id), "court_id": court_id, "judge": judge, "date": on.isoformat(),
                    "heading": heading, "cases": cases}
        return _cached(key, make)


class LahoreHighCourt:
    """data.lhc.gov.pk case status — number like 57482/26 and a bench letter."""

    def by_case_number(self, case_number: str, bench: str) -> Optional[dict]:
        bench = (bench or "L").upper()[:1]
        if bench not in LHC_BENCHES:
            raise HTTPException(status_code=400, detail="Choose the bench: Lahore, Rawalpindi, Multan or Bahawalpur.")
        num = _clean(case_number).replace(" ", "")
        m = re.fullmatch(r"(?:[A-Za-z.\-]+)?(\d{1,6})/(\d{2}|\d{4})", num)
        if not m:
            raise HTTPException(status_code=400, detail="Enter the case number as printed, for example 57482/26.")
        num = f"{m.group(1)}/{m.group(2)[-2:]}"

        def make():
            params = {"courtName": "All Courts", "bench": bench, "caseNumber": num, "hearingDate": "", "partyName": ""}
            try:
                r = requests.get(LHC_STATUS, params=params, headers=UA, timeout=LHC_TIMEOUT)
                r.raise_for_status()
            except requests.RequestException as exc:
                log.warning("LHC status failed: %s", exc.__class__.__name__)
                raise HTTPException(status_code=503, detail="The Lahore High Court site is not answering right now. It is often slow; try again in a minute or enter the details manually.")
            soup = BeautifulSoup(r.text, "html.parser")
            for table in soup.select("table"):
                rows = _rows(table)
                if not rows or not any("Case" in c for c in rows[0]):
                    continue
                head = [h.lower() for h in rows[0]]
                for row in rows[1:]:
                    if len(row) != len(head):
                        continue
                    kv = dict(zip(head, row))
                    title = next((v for k, v in kv.items() if "title" in k), "")
                    rec = _record(
                        source="lhc_case_status", source_url=r.url, case_number=next((v for k, v in kv.items() if "case" in k), num),
                        title=title, judge=next((v for k, v in kv.items() if "judge" in k), None),
                        bench=LHC_BENCHES[bench], court=f"Lahore High Court, {LHC_BENCHES[bench]}",
                        last_hearing=_parse_date(next((v for k, v in kv.items() if "hearing" in k), "")),
                        short_order=next((v for k, v in kv.items() if "result" in k), None), **_split_title(title),
                    )
                    rec["status"] = "Pending" if rec["short_order"] and "dispos" not in rec["short_order"].lower() else rec.get("status")
                    rec["stage"] = rec["short_order"]
                    loc = next((v for k, v in kv.items() if "location" in k), None)
                    if loc:
                        rec["court"] = f"Lahore High Court, {loc}"
                    return rec
            return None
        return _cached(f"lhc:{bench}:{num}", make)


district_portal = PunjabDistrictPortal()
lhc_status = LahoreHighCourt()
