import os
import time
from typing import List

import requests


class EmbeddingQuotaExceeded(Exception):
    """Raised when the provider's quota/rate limit is exhausted after retries.

    The ingestion pipeline catches this to stop gracefully — already-upserted
    chunks persist, and a later resume run skips them.
    """


class VoyageEmbeddings:
    """Cloud embeddings via Voyage AI (voyage-3.5, 1024-dim). No local model.

    Voyage supports asymmetric retrieval via input_type: documents are embedded
    with input_type="document", queries with input_type="query". Same model is
    used for both so vectors are comparable.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "voyage-3.5",
        output_dimension: int = 1024,
        batch_size: int = 64,
        timeout: int = 60,
        max_retries: int = 5,
    ):
        self.model = model
        self.output_dimension = output_dimension
        self.batch_size = batch_size
        self.timeout = timeout
        self.max_retries = max_retries
        self.url = "https://api.voyageai.com/v1/embeddings"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

    def _embed(self, inputs: List[str], input_type: str) -> List[List[float]]:
        payload = {
            "input": inputs,
            "model": self.model,
            "input_type": input_type,
            "output_dimension": self.output_dimension,
        }
        last_err = None
        for attempt in range(self.max_retries):
            try:
                resp = self.session.post(self.url, json=payload, timeout=self.timeout)
                if resp.status_code == 200:
                    data = resp.json()["data"]
                    data.sort(key=lambda d: d.get("index", 0))
                    return [d["embedding"] for d in data]
                if resp.status_code == 429:
                    wait = 2 ** attempt
                    print(f"[Voyage] HTTP 429 (rate limit), retry in {wait}s "
                          f"({attempt + 1}/{self.max_retries})")
                    time.sleep(wait)
                    last_err = EmbeddingQuotaExceeded(resp.text[:200])
                    continue
                if resp.status_code in (500, 502, 503, 504):
                    time.sleep(2 ** attempt)
                    last_err = RuntimeError(f"HTTP {resp.status_code}")
                    continue
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
            except requests.RequestException as exc:
                last_err = exc
                time.sleep(2 ** attempt)
        if isinstance(last_err, EmbeddingQuotaExceeded):
            raise last_err
        raise RuntimeError(f"Voyage embeddings failed after {self.max_retries} retries: {last_err}")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        for i in range(0, len(texts), self.batch_size):
            chunk = [t if t.strip() else " " for t in texts[i:i + self.batch_size]]
            vectors.extend(self._embed(chunk, "document"))
        return vectors

    def embed_query(self, text: str) -> List[float]:
        return self._embed([text], "query")[0]


class EmbeddingsService:
    """Lazy singleton. Cloud (Voyage) when a key is set, else local HF model."""

    def __init__(self):
        self.embeddings_instance = None

    def get_embeddings(self):
        if self.embeddings_instance is not None:
            return self.embeddings_instance

        voyage_key = os.getenv("VOYAGE_API_KEY", "").strip()
        if voyage_key:
            model = os.getenv("VOYAGE_MODEL", "voyage-3.5")
            self.embeddings_instance = VoyageEmbeddings(
                api_key=voyage_key,
                model=model,
                output_dimension=int(os.getenv("EMBEDDING_DIM", "1024")),
                batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "64")),
            )
            print(f"✅ Cloud embeddings: Voyage AI / {model} (1024-dim, no local model loaded)")
        else:
            from langchain_huggingface import HuggingFaceEmbeddings
            model_name = os.getenv("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
            self.embeddings_instance = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={"device": os.getenv("EMBEDDING_DEVICE", "cpu")},
                encode_kwargs={"normalize_embeddings": True, "batch_size": 32},
                cache_folder=None,
            )
            print(f"✅ Local embeddings loaded: {model_name}")
        return self.embeddings_instance

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return self.get_embeddings().embed_documents(texts)

    def embed_query(self, query: str) -> List[float]:
        return self.get_embeddings().embed_query(query)


embeddings_service = EmbeddingsService()


def get_embeddings():
    return embeddings_service.get_embeddings()


def embed_texts(texts: List[str]) -> List[List[float]]:
    return embeddings_service.embed_texts(texts)


def embed_query(query: str) -> List[float]:
    return embeddings_service.embed_query(query)
