import hashlib
import json
import os
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import threading


class CacheService:
    def __init__(self):
        self.cache_lock = threading.RLock()
        self.answer_cache: Dict[str, Dict[str, Any]] = {}
        self.answer_cache_ttl = timedelta(days=int(os.getenv("CACHE_ANSWER_TTL_DAYS", "7")))
        self.max_cache_size = int(os.getenv("CACHE_MAX_SIZE", "1000"))

    def make_cache_key(self, query: str, filters: Optional[Dict] = None) -> str:
        """Generate a deterministic cache key from query and filters."""
        data = json.dumps(
            {"query": query.lower().strip(), "filters": filters or {}},
            sort_keys=True,
        )
        return hashlib.md5(data.encode()).hexdigest()

    def is_expired(self, timestamp: datetime, ttl: timedelta) -> bool:
        """Check if a cache entry has expired."""
        return datetime.now() - timestamp > ttl

    def evict_if_needed(self, cache: Dict):
        """Remove oldest entries if cache exceeds max size."""
        if len(cache) > self.max_cache_size:
            sorted_items = sorted(cache.items(), key=lambda x: x[1].get("timestamp", datetime.now()))
            remove_count = self.max_cache_size // 5
            for key, _ in sorted_items[:remove_count]:
                del cache[key]

    def get_cached_answer(self, query: str, filters: Optional[Dict] = None) -> Optional[Dict]:
        """Retrieve cached final answer if available and not expired."""
        cache_key = self.make_cache_key(query, filters)

        with self.cache_lock:
            if cache_key in self.answer_cache:
                entry = self.answer_cache[cache_key]
                if not self.is_expired(entry["timestamp"], self.answer_cache_ttl):
                    return entry["result"]
                del self.answer_cache[cache_key]

        return None

    def set_cached_answer(self, query: str, answer: str, sources: List[Dict], filters: Optional[Dict] = None):
        """Cache final answer + sources."""
        cache_key = self.make_cache_key(query, filters)

        with self.cache_lock:
            self.answer_cache[cache_key] = {
                "result": {
                    "answer": answer,
                    "sources": sources,
                    "query": query,
                },
                "timestamp": datetime.now(),
            }
            self.evict_if_needed(self.answer_cache)

    def clear_cache(self):
        """Clear all caches (useful for testing/admin)."""
        with self.cache_lock:
            self.answer_cache.clear()

    def get_cache_stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        with self.cache_lock:
            return {
                "answer_cache_size": len(self.answer_cache),
                "answer_cache_ttl_days": self.answer_cache_ttl.total_seconds() / (3600 * 24),
            }


cache_service = CacheService()
