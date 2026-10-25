"""
Document Processor — Extracts text from PDFs, chunks, embeds, and stores in Qdrant.
Supports clean PDFs (pdfplumber) with OCR fallback (pytesseract).
Each document is tagged with a unique qdrant_doc_id for user-scoped retrieval.
"""

import uuid
import pdfplumber
from typing import List, Dict, Any

from backend.services.embeddings import embeddings_service
from backend.services.sparse import sparse_service
from backend.services.qdrant import qdrant_service, COLLECTION_NAME
from qdrant_client.models import PointStruct


class DocumentProcessorService:
    def extract_text_from_pdf(self, file_path: str) -> tuple[str, int]:
        """Extract text from PDF. Returns (full_text, page_count)."""
        pages_text: List[str] = []
        try:
            with pdfplumber.open(file_path) as pdf:
                page_count = len(pdf.pages)
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    if text.strip():
                        pages_text.append(text)

            full_text = "\n\n".join(pages_text)
            if len(full_text.strip()) < 100 and page_count > 0:
                full_text = self.ocr_fallback(file_path)

            return full_text, page_count
        except Exception as error:
            print(f"⚠️ PDF extraction error: {error}")
            try:
                return self.ocr_fallback(file_path), 0
            except Exception as ocr_error:
                raise ValueError(f"Failed to extract text from PDF: {error}; OCR also failed: {ocr_error}")

    def ocr_fallback(self, file_path: str) -> str:
        """OCR fallback for scanned PDFs using pdf2image + pytesseract."""
        try:
            from pdf2image import convert_from_path
            import pytesseract

            images = convert_from_path(file_path, dpi=200, first_page=1, last_page=20)
            texts: List[str] = []
            for image in images:
                text = pytesseract.image_to_string(image, lang="eng")
                if text.strip():
                    texts.append(text)
            return "\n\n".join(texts)
        except ImportError:
            return ""
        except Exception:
            return ""

    def chunk_text(self, text: str, chunk_size: int = 1500, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks for embedding."""
        if not text or not text.strip():
            return []

        normalized_text = " ".join(text.split())
        chunks: List[str] = []
        start = 0

        while start < len(normalized_text):
            end = start + chunk_size
            if end < len(normalized_text):
                for boundary in [". ", ".\n", "? ", "! ", ";\n", "\n\n"]:
                    last_boundary = normalized_text.rfind(boundary, start + chunk_size // 2, end + 100)
                    if last_boundary != -1:
                        end = last_boundary + len(boundary)
                        break

            chunk = normalized_text[start:end].strip()
            if chunk and len(chunk) > 50:
                chunks.append(chunk)

            start = end - overlap
            if start >= len(normalized_text):
                break

        return chunks

    def build_document_filter(self, document_id: str):
        from qdrant_client.models import Filter as QdrantFilter, FieldCondition, MatchValue

        return QdrantFilter(must=[
            FieldCondition(key="document_id", match=MatchValue(value=document_id))
        ])

    def process_and_store_document(
        self,
        file_path: str,
        user_id: int,
        qdrant_doc_id: str,
        original_name: str,
    ) -> Dict[str, Any]:
        """
        Full pipeline: Extract → Chunk → Embed → Store in Qdrant.
        Returns: {"page_count": int, "chunk_count": int, "status": str}
        """
        full_text, page_count = self.extract_text_from_pdf(file_path)
        if not full_text or len(full_text.strip()) < 50:
            return {
                "page_count": 0,
                "chunk_count": 0,
                "status": "failed",
                "error": "Could not extract meaningful text from the PDF.",
            }

        chunks = self.chunk_text(full_text, chunk_size=1500, overlap=200)
        if not chunks:
            return {
                "page_count": page_count,
                "chunk_count": 0,
                "status": "failed",
                "error": "Text extracted but no valid chunks could be created.",
            }

        client = qdrant_service.get_qdrant_client()
        points: List[PointStruct] = []

        # Batch-embed all chunks (dense + sparse) in one pass each.
        vectors = embeddings_service.embed_texts(chunks)
        sparse_vectors = sparse_service.embed_documents(chunks)
        for index, (chunk, vector, svec) in enumerate(zip(chunks, vectors, sparse_vectors)):
            point_id = str(uuid.uuid4())

            points.append(PointStruct(
                id=point_id,
                vector={"dense": vector, "sparse": svec},
                payload={
                    "content": chunk,
                    "doc_type": "user_upload",
                    "user_id": user_id,
                    "document_id": qdrant_doc_id,
                    "original_name": original_name,
                    "chunk_index": index,
                    "total_chunks": len(chunks),
                    "case_title": original_name,
                    "title": original_name,
                    "case_number": "",
                    "court": "User Upload",
                    "year": "",
                    "pdf_url": "",
                    "judge": "",
                    "citation": "",
                    "petitioner": "",
                    "respondent": "",
                    "source_id": qdrant_doc_id,
                },
            ))

        batch_size = 100
        for offset in range(0, len(points), batch_size):
            client.upsert(collection_name=COLLECTION_NAME, points=points[offset: offset + batch_size])

        print(f"✅ Document '{original_name}' → {len(chunks)} chunks stored in Qdrant (doc_id={qdrant_doc_id})")

        return {
            "page_count": page_count,
            "chunk_count": len(chunks),
            "status": "ready",
        }

    def delete_document_chunks(self, qdrant_doc_id: str) -> None:
        """Delete all chunks for a document from Qdrant."""
        client = qdrant_service.get_qdrant_client()
        try:
            client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=self.build_document_filter(qdrant_doc_id),
            )
            print(f"🗑️ Deleted chunks for document {qdrant_doc_id}")
        except Exception as error:
            print(f"⚠️ Error deleting document chunks: {error}")

    def search_user_document(self, query: str, document_id: str, top_k: int = 8) -> List[Dict[str, Any]]:
        """Search within a specific user-uploaded document using vector similarity."""
        client = qdrant_service.get_qdrant_client()
        query_vector = embeddings_service.embed_query(query)

        try:
            response = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                using="dense",
                query_filter=self.build_document_filter(document_id),
                limit=top_k,
                with_payload=True,
                with_vectors=False,
            )
            points = response.points if hasattr(response, "points") else response
        except Exception as error:
            print(f"⚠️ Document search error: {error}")
            return []

        results: List[Dict[str, Any]] = []
        for point in points:
            payload = point.payload or {}
            results.append({
                "content": payload.get("content", ""),
                "chunk_index": payload.get("chunk_index", 0),
                "total_chunks": payload.get("total_chunks", 0),
                "score": point.score,
            })

        return results


document_processor_service = DocumentProcessorService()


def extract_text_from_pdf(file_path: str) -> tuple[str, int]:
    return document_processor_service.extract_text_from_pdf(file_path)


def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> List[str]:
    return document_processor_service.chunk_text(text, chunk_size=chunk_size, overlap=overlap)


def process_and_store_document(file_path: str, user_id: int, qdrant_doc_id: str, original_name: str) -> Dict[str, Any]:
    return document_processor_service.process_and_store_document(
        file_path=file_path,
        user_id=user_id,
        qdrant_doc_id=qdrant_doc_id,
        original_name=original_name,
    )


def delete_document_chunks(qdrant_doc_id: str) -> None:
    document_processor_service.delete_document_chunks(qdrant_doc_id)


def search_user_document(query: str, document_id: str, top_k: int = 8) -> List[Dict[str, Any]]:
    return document_processor_service.search_user_document(query=query, document_id=document_id, top_k=top_k)
