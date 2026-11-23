from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.interactors.firm_interactor import FirmContext, current_firm
from backend.interactors.vault_interactor import MAX_UPLOAD_BYTES, vault_interactor
from backend.schemas import VaultAuditOut, VaultDocumentOut, VaultDocumentUpdate, VaultStats

router = APIRouter()


def _ip(request: Request) -> Optional[str]:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None))


@router.get("/vault/documents", response_model=List[VaultDocumentOut])
def list_documents(client_id: Optional[int] = None, matter_id: Optional[int] = None, category: Optional[str] = None,
                   search: Optional[str] = None, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return vault_interactor.list_documents(ctx, db, client_id=client_id, matter_id=matter_id,
                                           category=category, search=search)


@router.post("/vault/documents", response_model=VaultDocumentOut)
def upload_document(request: Request, file: UploadFile = File(...), title: Optional[str] = Form(None),
                    category: str = Form("other"), description: Optional[str] = Form(None),
                    client_id: Optional[int] = Form(None), matter_id: Optional[int] = Form(None),
                    ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    return vault_interactor.upload(ctx, db, data=data, filename=file.filename or "document", title=title,
                                   category=category, description=description, client_id=client_id,
                                   matter_id=matter_id, ip=_ip(request))


@router.get("/vault/documents/{doc_id}/file")
def get_file(doc_id: int, request: Request, inline: bool = False,
             ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    doc, data, show_inline = vault_interactor.read_file(ctx, doc_id, db, inline=inline, ip=_ip(request))
    disposition = "inline" if show_inline else "attachment"
    return Response(content=data, media_type=doc.content_type, headers={
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(doc.original_filename)}",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
    })


@router.put("/vault/documents/{doc_id}", response_model=VaultDocumentOut)
def update_document(doc_id: int, body: VaultDocumentUpdate, request: Request,
                    ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return vault_interactor.update(ctx, doc_id, body.model_dump(exclude_unset=True), db, _ip(request))


@router.delete("/vault/documents/{doc_id}")
def delete_document(doc_id: int, request: Request, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return vault_interactor.delete(ctx, doc_id, db, _ip(request))


@router.get("/vault/audit", response_model=List[VaultAuditOut])
def audit_log(document_id: Optional[int] = None, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return vault_interactor.audit_log(ctx, db, document_id)


@router.get("/vault/stats", response_model=VaultStats)
def stats(ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return vault_interactor.stats(ctx, db)
