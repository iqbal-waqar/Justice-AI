"""Answer cache for first-turn questions.

Backend: Redis when REDIS_URL is set and reachable — survives restarts and is
shared by every uvicorn worker. Otherwise an in-process dict (lost on restart,
per worker), with a startup log line saying so. A Redis outage at runtime never
breaks chat: lookups count as misses and writes are skipped.
"""
import hashlib
import json
import os
import threading
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.services.qdrant import COLLECTION_NAME

KEY_PREFIX = os.getenv("CACHE_KEY_PREFIX", "justiceai:answer:")


class CacheService:
    def __init__(self):
        self.answer_cache_ttl = timedelta(days=int(os.getenv("CACHE_ANSWER_TTL_DAYS") or "7"))
        self.max_cache_size = int(os.getenv("CACHE_MAX_SIZE") or "1000")
        self.cache_lock = threading.RLock()
        self.answer_cache: Dict[str, Dict[str, Any]] = {}
        self.redis = None
        self.backend = "memory"
        self._connect_redis()

    # ── backend selection ──────────────────────────────────────────────
    def _connect_redis(self) -> None:
        url = os.getenv("REDIS_URL", "").strip()
        if not url:
            print("ℹ️ Answer cache: in-memory (set REDIS_URL to persist across restarts/workers)")
            return
        try:
            import redis
            client = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2, decode_responses=True)
            client.ping()
            self.redis, self.backend = client, "redis"
            print(f"✅ Answer cache: Redis ({url.split('@')[-1]})")
        except Exception as exc:
            print(f"⚠️ Answer cache: Redis unavailable ({exc.__class__.__name__}: {exc}) — using in-memory cache")

    # ── keys / policy ──────────────────────────────────────────────────
    def make_cache_key(self, query: str, filters: Optional[Dict] = None) -> str:
        """Deterministic key; includes the collection so a re-index doesn't serve stale answers."""
        data = json.dumps(
            {"query": " ".join(query.lower().split()), "filters": filters or {}, "collection": COLLECTION_NAME},
            sort_keys=True,
        )
        return KEY_PREFIX + hashlib.md5(data.encode()).hexdigest()

    @staticmethod
    def should_cache(answer: str, sources: List[Dict]) -> bool:
        """Cache only real, sourced answers — never fallbacks/errors (they may be
        transient, e.g. a provider outage) and never greetings (no sources)."""
        if not answer or not sources:
            return False
        if "### Grounded Response" in answer or answer.startswith("⚠️"):
            return False
        return True

    # ── API ────────────────────────────────────────────────────────────
    def get_cached_answer(self, query: str, filters: Optional[Dict] = None) -> Optional[Dict]:
        key = self.make_cache_key(query, filters)
        if self.redis is not None:
            try:
                raw = self.redis.get(key)
                return json.loads(raw) if raw else None
            except Exception as exc:
                print(f"⚠️ Redis cache read failed ({exc.__class__.__name__}) — treating as miss")
                return None
        with self.cache_lock:
            entry = self.answer_cache.get(key)
            if not entry:
                return None
            if datetime.now() - entry["timestamp"] > self.answer_cache_ttl:
                del self.answer_cache[key]
                return None
            return entry["result"]

    def set_cached_answer(self, query: str, answer: str, sources: List[Dict], filters: Optional[Dict] = None):
        key = self.make_cache_key(query, filters)
        result = {"answer": answer, "sources": sources, "query": query}
        if self.redis is not None:
            try:
                self.redis.setex(key, int(self.answer_cache_ttl.total_seconds()), json.dumps(result, ensure_ascii=False))
            except Exception as exc:
                print(f"⚠️ Redis cache write failed ({exc.__class__.__name__}) — skipped")
            return
        with self.cache_lock:
            self.answer_cache[key] = {"result": result, "timestamp": datetime.now()}
            if len(self.answer_cache) > self.max_cache_size:
                oldest = sorted(self.answer_cache.items(), key=lambda x: x[1]["timestamp"])
                for k, _ in oldest[: self.max_cache_size // 5]:
                    del self.answer_cache[k]

    def _redis_keys(self):
        return self.redis.scan_iter(match=KEY_PREFIX + "*", count=500)

    def clear_cache(self):
        """Delete only this app's keys (never FLUSHDB — the Redis may be shared)."""
        if self.redis is not None:
            try:
                batch = []
                for k in self._redis_keys():
                    batch.append(k)
                    if len(batch) >= 500:
                        self.redis.delete(*batch); batch = []
                if batch:
                    self.redis.delete(*batch)
            except Exception as exc:
                print(f"⚠️ Redis cache clear failed ({exc.__class__.__name__})")
            return
        with self.cache_lock:
            self.answer_cache.clear()

    def get_cache_stats(self) -> Dict[str, Any]:
        stats = {"backend": self.backend, "answer_cache_ttl_days": self.answer_cache_ttl.total_seconds() / 86400}
        if self.redis is not None:
            try:
                stats["answer_cache_size"] = sum(1 for _ in self._redis_keys())
            except Exception as exc:
                stats["answer_cache_size"] = None
                stats["error"] = f"{exc.__class__.__name__}"
        else:
            with self.cache_lock:
                stats["answer_cache_size"] = len(self.answer_cache)
        return stats


cache_service = CacheService()
