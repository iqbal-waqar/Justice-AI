import os
import threading
import time
from collections import OrderedDict
from typing import List

import requests

from backend.services.tracing import traceable, summarize_vector


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
    """Lazy singleton around Voyage embeddings.

    The Qdrant collection stores 1024-dim voyage-3.5 vectors, so queries MUST be
    embedded with the same model — a local fallback model would produce vectors
    in a different space (and dimension) and silently return garbage results.
    """

    def __init__(self):
        self.embeddings_instance = None
        self._query_cache: "OrderedDict[str, List[float]]" = OrderedDict()
        self._cache_lock = threading.Lock()
        self._cache_size = int(os.getenv("QUERY_EMBED_CACHE_SIZE", "512"))

    def get_embeddings(self) -> VoyageEmbeddings:
        if self.embeddings_instance is not None:
            return self.embeddings_instance

        voyage_key = os.getenv("VOYAGE_API_KEY", "").strip()
        if not voyage_key:
            raise RuntimeError(
                "VOYAGE_API_KEY is not set. The Qdrant index was built with Voyage "
                "embeddings, so search cannot run without it."
            )
        model = os.getenv("VOYAGE_MODEL", "voyage-3.5")
        self.embeddings_instance = VoyageEmbeddings(
            api_key=voyage_key,
            model=model,
            output_dimension=int(os.getenv("EMBEDDING_DIM", "1024")),
            batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "64")),
        )
        print(f"✅ Cloud embeddings: Voyage AI / {model} (1024-dim)")
        return self.embeddings_instance

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return self.get_embeddings().embed_documents(texts)

    @traceable(name="Voyage embed query", run_type="embedding", process_outputs=summarize_vector)
    def embed_query(self, query: str) -> List[float]:
        key = query.strip()
        with self._cache_lock:
            if key in self._query_cache:
                self._query_cache.move_to_end(key)
                return self._query_cache[key]
        vec = self.get_embeddings().embed_query(key)
        with self._cache_lock:
            self._query_cache[key] = vec
            if len(self._query_cache) > self._cache_size:
                self._query_cache.popitem(last=False)
        return vec


embeddings_service = EmbeddingsService()


def get_embeddings():
    return embeddings_service.get_embeddings()


def embed_texts(texts: List[str]) -> List[List[float]]:
    return embeddings_service.embed_texts(texts)


def embed_query(query: str) -> List[float]:
    return embeddings_service.embed_query(query)
