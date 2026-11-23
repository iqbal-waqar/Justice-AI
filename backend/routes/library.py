from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.database.migrations.library import RESOURCE_CATEGORIES
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.firm_interactor import FirmContext, current_firm
from backend.interactors.library_interactor import MAX_UPLOAD_BYTES, library_interactor
from backend.schemas import LawSearchOut, LibraryResourceOut
from backend.services.law_library import search_laws

router = APIRouter()


@router.get("/library/laws", response_model=LawSearchOut)
def list_laws(q: str = "", jurisdiction: str = "", category: str = "", page: int = 1, page_size: int = 30,
              _user=Depends(auth_interactor.resolve_current_user)):
    return search_laws(q=q, jurisdiction=jurisdiction, category=category, page=page, page_size=page_size)


@router.get("/library/resource-categories", response_model=List[str])
def resource_categories(_user=Depends(auth_interactor.resolve_current_user)):
    return list(RESOURCE_CATEGORIES)


@router.get("/library/resources", response_model=List[LibraryResourceOut])
def list_resources(search: Optional[str] = None, tag: Optional[str] = None, category: Optional[str] = None,
                   ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return library_interactor.list_resources(ctx, db, search=search, tag=tag, category=category)


@router.post("/library/resources", response_model=LibraryResourceOut)
def add_resource(file: UploadFile = File(...), title: Optional[str] = Form(None), description: Optional[str] = Form(None),
                 category: str = Form("General"), tags: Optional[str] = Form(None), language: Optional[str] = Form(None),
                 ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    return library_interactor.upload(ctx, db, data=data, filename=file.filename or "resource.pdf", title=title,
                                     description=description, category=category, tags=tags, language=language)


@router.get("/library/resources/{res_id}/file")
def resource_file(res_id: int, download: bool = False, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    res, data = library_interactor.read_file(ctx, res_id, db)
    disposition = "attachment" if download else "inline"
    return Response(content=data, media_type="application/pdf", headers={
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(res.original_filename)}",
        "X-Content-Type-Options": "nosniff",
    })


@router.get("/library/resources/{res_id}/thumbnail")
def resource_thumbnail(res_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    _, data = library_interactor.read_file(ctx, res_id, db, kind="png")
    return Response(content=data, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/library/resources/{res_id}")
def delete_resource(res_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return library_interactor.delete(ctx, res_id, db)
