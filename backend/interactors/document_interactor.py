import os
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.database.models import DocumentRepository
from backend.schemas import DocumentChatResponse, DocumentResponse
from backend.services.document_processor import document_processor_service


class DocumentInteractor:
    def __init__(self):
        self.upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")

    async def upload_document(self, file: UploadFile, user_id: int, db: Session) -> DocumentResponse:
        repo = DocumentRepository(db)
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")

        content = await file.read()
        file_size = len(content)
        if file_size > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")

        user_dir = os.path.join(self.upload_dir, str(user_id))
        os.makedirs(user_dir, exist_ok=True)

        qdrant_doc_id = str(uuid.uuid4())
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "pdf"
        stored_filename = f"{qdrant_doc_id}.{ext}"
        file_path = os.path.join(user_dir, stored_filename)

        with open(file_path, "wb") as output:
            output.write(content)

        doc = repo.create(
            {
                "user_id": user_id,
                "filename": stored_filename,
                "original_name": file.filename,
                "file_size": file_size,
                "qdrant_doc_id": qdrant_doc_id,
                "status": "processing",
            }
        )

        try:
            result = document_processor_service.process_and_store_document(
                file_path=file_path,
                user_id=user_id,
                qdrant_doc_id=qdrant_doc_id,
                original_name=file.filename,
            )
            doc = repo.update(
                doc,
                {
                    "page_count": result.get("page_count", 0),
                    "chunk_count": result.get("chunk_count", 0),
                    "status": result.get("status", "failed"),
                    "error_message": result.get("error"),
                },
            )
        except Exception as exc:
            repo.update(doc, {"status": "failed", "error_message": str(exc)[:500]})
            raise HTTPException(status_code=500, detail=f"Document processing failed: {str(exc)[:200]}")

        return self.to_document_response(doc)

    def list_documents(self, user_id: int, db: Session) -> list[DocumentResponse]:
        repo = DocumentRepository(db)
        docs = repo.get_by_user(user_id)
        return [self.to_document_response(item) for item in docs]

    def delete_document(self, doc_id: int, user_id: int, db: Session):
        repo = DocumentRepository(db)
        doc = repo.get_by_id_and_user(doc_id, user_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        document_processor_service.delete_document_chunks(doc.qdrant_doc_id)

        user_dir = os.path.join(self.upload_dir, str(user_id))
        file_path = os.path.join(user_dir, doc.filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        repo.delete(doc)
        return {"message": "Document deleted successfully"}

    def chat_with_document(self, doc_id: int, query: str, user_id: int, db: Session) -> DocumentChatResponse:
        repo = DocumentRepository(db)
        doc = repo.get_by_id_and_user(doc_id, user_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.status != "ready":
            raise HTTPException(status_code=400, detail="Document is still processing or failed.")

        results = document_processor_service.search_user_document(
            query=query,
            document_id=doc.qdrant_doc_id,
            top_k=8,
        )
        if not results:
            return DocumentChatResponse(
                answer="No relevant content found in this document for your query.",
                chunks_used=0,
                document_name=doc.original_name,
            )

        context_parts = []
        for index, item in enumerate(results, 1):
            context_parts.append(f"[Chunk {index} | score={item['score']:.3f}]\\n{item['content']}")
        context = "\\n\\n---\\n\\n".join(context_parts)

        from backend.services.llm import llm_service

        llm = llm_service.get_llm()
        prompt = f"""You are a legal document analyst. Answer the user's question using ONLY the document content provided below. Do NOT use any outside knowledge.

DOCUMENT: {doc.original_name}

--- RETRIEVED CONTENT ---
{context}
--- END CONTENT ---

USER QUESTION: {query}

RULES:
1. Answer ONLY from the document content above. If the answer is not in the content, say \"This information is not found in the uploaded document.\"
2. Quote specific text from the document when relevant.
3. Be precise and thorough.
4. Use markdown formatting for readability.
5. If the document discusses legal provisions, cite them accurately from the text."""

        try:
            response = llm.invoke(prompt)
            answer = response.content
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"LLM error: {str(exc)[:200]}")

        return DocumentChatResponse(answer=answer, chunks_used=len(results), document_name=doc.original_name)

    def to_document_response(self, doc) -> DocumentResponse:
        return DocumentResponse(
            id=doc.id,
            original_name=doc.original_name,
            file_size=doc.file_size,
            page_count=doc.page_count,
            chunk_count=doc.chunk_count,
            status=doc.status,
            error_message=doc.error_message,
            qdrant_doc_id=doc.qdrant_doc_id,
            created_at=str(doc.created_at) if doc.created_at else None,
        )
