from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.document_interactor import DocumentInteractor
from backend.schemas import DocumentResponse, DocumentChatRequest, DocumentChatResponse

router = APIRouter()
interactor = DocumentInteractor()


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return await interactor.upload_document(file, current_user.id, db)


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.list_documents(current_user.id, db)


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.delete_document(doc_id, current_user.id, db)


@router.post("/documents/{doc_id}/chat", response_model=DocumentChatResponse)
def chat_with_document(
    doc_id: int,
    req: DocumentChatRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.chat_with_document(doc_id, req.query, current_user.id, db)
