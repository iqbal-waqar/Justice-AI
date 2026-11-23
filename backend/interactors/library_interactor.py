import io
import json
import os
import uuid
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.database.migrations.library import RESOURCE_CATEGORIES, LibraryResource
from backend.database.migrations.user import User
from backend.interactors.firm_interactor import FirmContext

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
STORE = os.path.abspath(os.path.join(ROOT, "storage", "library"))
SEED_DIR = os.path.abspath(os.path.join(ROOT, "backend", "assets", "library"))
DOWNLOAD_DIR = os.path.abspath(os.path.join(ROOT, "data", "library_seed"))
LHC_RULES = "https://lhc.gov.pk/system/files/"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_TAGS = 8

SYSTEM_RESOURCES = (
    {"file": "court-certificate.pdf", "title": "Court Certificate", "category": "General",
     "description": "Certificate of a witness's attendance in court, issued by the court reader.",
     "tags": ["Civil", "Criminal", "Session Court", "Civil Court"], "language": "Urdu"},
    {"file": "copy-form-urdu.pdf", "title": "Copy Form Urdu", "category": "Forms",
     "description": "Application for obtaining certified copies (darkhwast bara-e-husool-e-naqal).",
     "tags": ["Session Court", "Civil Court", "High Court"], "language": "Urdu"},
    {"file": "warrant-giraftari-bila-zamanat.pdf", "title": "Warrant giraftari Bila Zamanat", "category": "General",
     "description": "Non-bailable warrant of arrest addressed to the SHO.",
     "tags": ["Criminal", "Session Court"], "language": "Urdu"},
)

_RULES_VOLUMES = (
    (1, "I", "Instructions to Civil Courts", "Volume1_0.pdf", "Vol1_0.pdf", ["Civil", "Civil Court", "High Court"]),
    (2, "II", "Instructions to Civil Courts (Special Jurisdiction and Accounts)", "volume2_compressed_0.pdf", "Vol2_0.pdf",
     ["Civil", "Family", "Civil Court", "High Court"]),
    (3, "III", "Instructions to Criminal Courts", "volume3_0.pdf", "Vol3_0.pdf", ["Criminal", "Session Court", "High Court"]),
    (4, "IV", "Instructions to Civil Courts", "volume4_0.pdf", "Vol4_0_0.pdf", ["Civil", "Civil Court", "High Court"]),
    (5, "V", "Relating to Proceedings in the High Court (Revised Edition 2010)",
     "Rules%20%26%20Orders%20of%20Lahore%20High%20Court%20V-5%20%282010%20edition%29.pdf", "Amendments%20Final_0.pdf", ["High Court"]),
)
for _num, _vol, _subject, _main, _amend, _tags in _RULES_VOLUMES:
    SYSTEM_RESOURCES += (
        {"file": f"lhc-rules-orders-vol{_num}.pdf",
         "url": LHC_RULES + _main, "title": f"LHC Rules & Orders — Volume {_vol}", "category": "Rules & Orders",
         "description": f"Lahore High Court Rules and Orders, Volume {_vol}: {_subject}. Official copy from lhc.gov.pk.",
         "tags": _tags, "language": "English"},
        {"file": f"lhc-rules-orders-vol{_num}-amendments.pdf",
         "url": LHC_RULES + _amend, "title": f"LHC Rules & Orders — Volume {_vol}: Amendments", "category": "Rules & Orders",
         "description": f"Amendments to Volume {_vol} ({_subject}) of the Lahore High Court Rules and Orders. Official copy from lhc.gov.pk.",
         "tags": _tags, "language": "English"},
    )


# Judicial forms collected by fetch_judicial_forms.py (data/library_seed/forms/ + a manifest).
_FORMS_MANIFEST = os.path.join(ROOT, "backend", "assets", "judicial_forms.json")
if os.path.exists(_FORMS_MANIFEST):
    try:
        with open(_FORMS_MANIFEST, encoding="utf-8") as _fh:
            SYSTEM_RESOURCES += tuple(json.load(_fh))
    except (OSError, ValueError) as _exc:
        print(f"⚠️ judicial_forms.json could not be read: {_exc}")


def _clean_tags(tags) -> List[str]:
    if isinstance(tags, str):
        tags = tags.split(",")
    out = []
    for t in tags or []:
        t = " ".join(str(t).split())[:30]
        if t and t.lower() not in {x.lower() for x in out}:
            out.append(t)
    return out[:MAX_TAGS]


def _pdf_info(data: bytes) -> Optional[int]:
    """Page count, or None when the file cannot be read as a PDF."""
    import pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return len(pdf.pages)
    except Exception:
        return None


def _make_thumbnail(pdf_path: str, png_path: str) -> None:
    try:
        from pdf2image import convert_from_path
        pages = convert_from_path(pdf_path, dpi=60, first_page=1, last_page=1, size=(360, None))
        if pages:
            pages[0].save(png_path, "PNG", optimize=True)
    except Exception as exc:
        print(f"⚠️ Could not render a preview for {os.path.basename(pdf_path)}: {exc.__class__.__name__}")


class LibraryInteractor:
    def _path(self, res: LibraryResource, kind: str = "pdf") -> str:
        return os.path.join(STORE, f"{res.stored_name}.{kind}")

    def _out(self, res: LibraryResource, ctx: Optional[FirmContext], db: Session) -> dict:
        uploader = db.get(User, res.uploaded_by) if res.uploaded_by else None
        return {
            "id": res.id, "title": res.title, "description": res.description, "category": res.category,
            "tags": _clean_tags(res.tags), "language": res.language, "original_filename": res.original_filename,
            "size_bytes": res.size_bytes, "page_count": res.page_count, "is_system": res.firm_id is None,
            "can_delete": bool(ctx and res.firm_id == ctx.firm_id and (res.uploaded_by == ctx.user.id or ctx.can_approve)),
            "uploaded_by_name": uploader.full_name if uploader else None, "created_at": res.created_at,
        }

    def _visible(self, ctx: FirmContext, res_id: int, db: Session) -> LibraryResource:
        res = db.query(LibraryResource).filter(
            LibraryResource.id == res_id,
            or_(LibraryResource.firm_id.is_(None), LibraryResource.firm_id == ctx.firm_id),
        ).first()
        if not res:
            raise HTTPException(status_code=404, detail="Resource not found")
        return res

    def _seed_source(self, item: dict) -> str:
        for folder in (SEED_DIR, DOWNLOAD_DIR):
            path = os.path.join(folder, item["file"])
            if os.path.exists(path):
                return path
        path = os.path.join(DOWNLOAD_DIR, item["file"])
        if item.get("url"):
            try:
                import requests
                r = requests.get(item["url"], timeout=300, headers={"User-Agent": "Mozilla/5.0 JusticeAI-law-library"})
                if r.ok and r.content.startswith(b"%PDF"):
                    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
                    with open(path, "wb") as fh:
                        fh.write(r.content)
            except Exception as exc:
                print(f"⚠️ Could not download {item['title']}: {exc.__class__.__name__}")
        return path

    def seed_system_resources(self, db: Session) -> int:
        os.makedirs(STORE, exist_ok=True)
        added = 0
        for item in SYSTEM_RESOURCES:
            src = self._seed_source(item)
            exists = db.query(LibraryResource).filter(LibraryResource.firm_id.is_(None),
                                                      LibraryResource.title == item["title"]).first()
            if exists or not os.path.exists(src):
                if exists and not os.path.exists(self._path(exists, "png")) and os.path.exists(self._path(exists)):
                    _make_thumbnail(self._path(exists), self._path(exists, "png"))
                continue
            with open(src, "rb") as fh:
                data = fh.read()
            res = LibraryResource(firm_id=None, title=item["title"], description=item["description"],
                                  category=item["category"], tags=",".join(item["tags"]), language=item["language"],
                                  original_filename=os.path.basename(item["file"]), stored_name=uuid.uuid4().hex,
                                  size_bytes=len(data), page_count=_pdf_info(data))
            with open(self._path(res), "wb") as fh:
                fh.write(data)
            _make_thumbnail(self._path(res), self._path(res, "png"))
            db.add(res)
            added += 1
        db.commit()
        return added

    def list_resources(self, ctx: FirmContext, db: Session, search: Optional[str] = None,
                       tag: Optional[str] = None, category: Optional[str] = None) -> List[dict]:
        query = db.query(LibraryResource).filter(
            or_(LibraryResource.firm_id.is_(None), LibraryResource.firm_id == ctx.firm_id))
        if category:
            query = query.filter(LibraryResource.category == category)
        items = query.order_by(LibraryResource.firm_id.isnot(None), LibraryResource.title).all()
        terms = (search or "").lower().split()
        out = []
        for res in items:
            tags = _clean_tags(res.tags)
            if tag and tag.lower() not in {t.lower() for t in tags}:
                continue
            hay = " ".join([res.title, res.description or "", res.category, " ".join(tags), res.language or ""]).lower()
            if all(t in hay for t in terms):
                out.append(self._out(res, ctx, db))
        return out

    def upload(self, ctx: FirmContext, db: Session, data: bytes, filename: str, title: Optional[str],
               description: Optional[str], category: str, tags: Optional[str], language: Optional[str]) -> dict:
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="The file is larger than 20 MB.")
        if not data.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Only PDF files can be added to the library.")
        try:
            pages = _pdf_info(data)
        except Exception:
            raise HTTPException(status_code=400, detail="This PDF could not be read. It may be damaged or password-protected.")
        if category not in RESOURCE_CATEGORIES:
            category = "Other"
        name = os.path.basename(filename or "resource.pdf")[:255]
        title = " ".join((title or os.path.splitext(name)[0]).split())[:200] or "Untitled resource"
        res = LibraryResource(firm_id=ctx.firm_id, title=title, description=(description or "").strip()[:500] or None,
                              category=category, tags=",".join(_clean_tags(tags)), language=(language or "").strip()[:20] or None,
                              original_filename=name, stored_name=uuid.uuid4().hex, size_bytes=len(data),
                              page_count=pages, uploaded_by=ctx.user.id)
        os.makedirs(STORE, exist_ok=True)
        with open(self._path(res), "wb") as fh:
            fh.write(data)
        _make_thumbnail(self._path(res), self._path(res, "png"))
        db.add(res)
        db.commit()
        db.refresh(res)
        return self._out(res, ctx, db)

    def read_file(self, ctx: FirmContext, res_id: int, db: Session, kind: str = "pdf"):
        res = self._visible(ctx, res_id, db)
        path = self._path(res, kind)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Preview not available" if kind == "png" else "File missing")
        with open(path, "rb") as fh:
            return res, fh.read()

    def delete(self, ctx: FirmContext, res_id: int, db: Session) -> dict:
        res = self._visible(ctx, res_id, db)
        ctx.require(res.firm_id is not None, "Built-in resources cannot be deleted.")
        ctx.require(res.uploaded_by == ctx.user.id or ctx.can_approve,
                    "Only the person who added this resource, or an owner or partner, can delete it.")
        for kind in ("pdf", "png"):
            try:
                os.remove(self._path(res, kind))
            except OSError:
                pass
        db.delete(res)
        db.commit()
        return {"message": "Resource deleted"}


library_interactor = LibraryInteractor()
