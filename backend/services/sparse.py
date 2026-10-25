"""
Sparse (BM25) embeddings via FastEmbed — for true full-corpus keyword search.

Qdrant stores these alongside the dense Voyage vectors and runs the keyword half
of hybrid search natively (full corpus, IDF-scored), replacing the old per-query
Python BM25 over a 500-doc scroll sample.
"""
import os
from typing import List

from qdrant_client.models import SparseVector


class SparseService:
    """Lazy singleton BM25 sparse embedder (FastEmbed `Qdrant/bm25`)."""

    def __init__(self):
        self._model = None

    def get_model(self):
        if self._model is None:
            from fastembed import SparseTextEmbedding
            model_name = os.getenv("SPARSE_MODEL", "Qdrant/bm25")
            self._model = SparseTextEmbedding(model_name)
            print(f"✅ Sparse (BM25) model loaded: {model_name}")
        return self._model

    @staticmethod
    def _to_sparse_vector(embedding) -> SparseVector:
        return SparseVector(
            indices=[int(i) for i in embedding.indices],
            values=[float(v) for v in embedding.values],
        )

    def embed_documents(self, texts: List[str]) -> List[SparseVector]:
        return [self._to_sparse_vector(e) for e in self.get_model().embed(texts)]

    def embed_query(self, text: str) -> SparseVector:
        # BM25 query embedding (term presence); Qdrant applies IDF via the modifier.
        emb = next(self.get_model().query_embed(text))
        return self._to_sparse_vector(emb)


sparse_service = SparseService()
