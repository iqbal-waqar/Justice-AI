"""Collect the judicial forms published at citylaws.pk and register them as built-in
Law Library resources (Resources & documents → Forms).

  1. reads the "Judicial Forms" category listing and every post in it,
  2. downloads each post's PDF(s) into data/library_seed/forms/,
  3. reads the first page of each PDF to decide its language (Urdu / English / both),
  4. writes backend/assets/judicial_forms.json — title, category, tags, language,
     description and source link — which the library seeds on the next backend start.

Safe to re-run: files already downloaded are kept; the manifest is rebuilt.

    python fetch_judicial_forms.py            # everything
    python fetch_judicial_forms.py --limit 5  # try a few first
"""
import argparse
import json
import os
import re
import sys
import time
from urllib.parse import unquote, urljoin

import requests
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.abspath(__file__))
CATEGORY = "https://citylaws.pk/category/publications/judicial-forms/"
OUT_DIR = os.path.join(ROOT, "data", "library_seed", "forms")
MANIFEST = os.path.join(ROOT, "backend", "assets", "judicial_forms.json")
HEADERS = {"User-Agent": "Mozilla/5.0 (JusticeAI law library)"}

# Resource category by what the form is for (RESOURCE_CATEGORIES in the library model).
CATEGORY_RULES = [
    ("Affidavits", r"affidavit"),
    ("Agreements", r"power of attorney|wakalat|pro note|receipt"),
    ("Notices", r"\bnotice|summon"),
    ("Petitions", r"petition|caveat|appeal"),
    ("Applications", r"application|proforma|request|early hearing|urgent|copy form|inspect|paper book|video link|registration|enter appearance|fitness|nomination|challan"),
    ("Forms", r"form|bond|warrant|certificate|sheet|schedule|precept|robakar|talbana|munhasra|paish|heirs"),
]
TAG_RULES = [
    ("Supreme Court", r"supreme court|\bsc\b"), ("High Court", r"high court|\bhc\b|\blhc\b|\bihc\b|bench"),
    ("Session Court", r"session|criminal|bail|warrant|accused|challan|robakar|surety|witness"),
    ("Civil Court", r"civil|suit|attachment|decree|judgment debtor|precept|property|succession|legal heirs|guardian"),
    ("Criminal", r"criminal|bail|warrant|arrest|accused|challan|robakar|surety|peace"),
    ("Civil", r"civil|suit|attachment|succession|property|precept|guardian|heirs|pro note"),
    ("Family", r"guardian|minor|succession|heirs"),
    ("Bar Council", r"bar council|advocate|asc\b|enrollment"),
    ("Azad Kashmir", r"azad kashmir|ajk"), ("Sindh", r"sindh"), ("Peshawar", r"peshawar"), ("Islamabad", r"islamabad"),
    ("Lahore", r"lahore|rawalpindi|bahawalpur|multan"), ("Tax", r"income tax|sales tax"),
]


def get(url: str) -> requests.Response:
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=60)
            if r.ok:
                return r
        except requests.RequestException:
            pass
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"could not fetch {url}")


def post_links() -> list:
    soup = BeautifulSoup(get(CATEGORY).text, "html.parser")
    seen, links = set(), []
    for a in soup.select("h2 a[href], h3 a[href], .entry-title a[href]"):
        href = a["href"].split("#")[0]
        if "citylaws.pk/" in href and "/category/" not in href and href not in seen:
            seen.add(href)
            links.append((a.get_text(" ", strip=True), href))
    return links


def pdf_links(post_url: str) -> tuple:
    soup = BeautifulSoup(get(post_url).text, "html.parser")
    title_el = soup.select_one("h1.entry-title, h1")
    title = title_el.get_text(" ", strip=True) if title_el else ""
    found = []
    for a in soup.select("a[href]"):
        href = urljoin(post_url, a["href"])
        if ".pdf" in href.lower() and "wp-content/uploads" in href:
            label = a.get_text(" ", strip=True)
            if href not in [f[0] for f in found]:
                found.append((href, label))
    return title, found


def clean_title(raw: str) -> str:
    """'Interim Bail Order form حکم عبوری ضمانت فارم' → English part first, Urdu kept in the description."""
    text = " ".join(raw.split())
    english = re.sub(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+", "", text)
    english = re.sub(r"[\s|/\-–—:]+$", "", " ".join(english.split()))
    urdu = " ".join(re.findall(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿][^A-Za-z]*", text)).strip()
    return english or text, urdu


def language_of(path: str, hint: str) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            text = " ".join((p.extract_text() or "") for p in pdf.pages[:2])
    except Exception:
        text = ""
    arabic = len(re.findall(r"[؀-ۿ]", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    if arabic + latin < 40:                      # scanned: go by the link, file name or an Urdu post title
        if re.search(r"english", hint, re.I):
            return "English"
        return "Urdu" if re.search(r"urdu", hint, re.I) else "English"
    if arabic > 3 * latin:
        return "Urdu"
    if latin > 3 * arabic:
        return "English"
    return "English / Urdu"


def categorise(title: str) -> str:
    low = title.lower()
    for cat, pat in CATEGORY_RULES:
        if re.search(pat, low):
            return cat
    return "Forms"


def tags_for(title: str) -> list:
    low = title.lower()
    return [tag for tag, pat in TAG_RULES if re.search(pat, low)][:6]


def slugify(url: str) -> str:
    slug = unquote(url.rstrip("/").rsplit("/", 1)[-1])
    slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return slug[:70] or "form"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, help="only the first N posts")
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    posts = post_links()
    if args.limit:
        posts = posts[:args.limit]
    print(f"📄 {len(posts)} posts in the Judicial Forms category")
    manifest, skipped = [], []
    for i, (list_title, url) in enumerate(posts, 1):
        try:
            title, files = pdf_links(url)
        except Exception as exc:
            skipped.append((list_title, f"{exc.__class__.__name__}")); continue
        if not files:
            skipped.append((list_title, "no PDF link")); continue
        en_title, ur_title = clean_title(title or list_title)
        slug = slugify(url)
        for n, (href, label) in enumerate(files):
            lang_hint = f"{label} {href}"
            name = slug if len(files) == 1 else f"{slug}-{'urdu' if re.search('urdu', lang_hint, re.I) else 'english' if re.search('english', lang_hint, re.I) else n + 1}"
            path = os.path.join(OUT_DIR, f"{name}.pdf")
            if not os.path.exists(path):
                r = get(href)
                if not r.content.startswith(b"%PDF"):
                    skipped.append((en_title, "not a PDF")); continue
                with open(path, "wb") as fh:
                    fh.write(r.content)
                time.sleep(0.4)
            language = language_of(path, lang_hint + (" urdu-title" if ur_title else ""))
            suffix = "" if len(files) == 1 else f" ({language})"
            manifest.append({
                "file": f"forms/{name}.pdf", "title": (en_title + suffix)[:200], "category": categorise(en_title),
                "language": language, "tags": tags_for(en_title),
                "description": (f"{ur_title + ' — ' if ur_title else ''}Judicial form as published by City Laws (citylaws.pk).")[:500],
                "source": url, "pdf_url": href,
            })
        print(f"  {i:3d}. {en_title} — {len(files)} file(s)")
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
    print(f"\n✅ {len(manifest)} PDFs recorded in {os.path.relpath(MANIFEST, ROOT)}")
    for title, why in skipped:
        print(f"   ⚠️ skipped {title}: {why}")


if __name__ == "__main__":
    sys.path.insert(0, ROOT)
    main()
