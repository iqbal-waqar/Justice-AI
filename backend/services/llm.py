import os
import threading
from typing import Dict, Tuple

from langchain_openai import ChatOpenAI


class LLMService:
    """Builds ChatOpenAI clients and REUSES them.

    A new ChatOpenAI per call meant a new HTTPS connection (TLS handshake, up to
    ~3s cold) for every one of the 3 LLM calls a question makes. Instances are
    cached per configuration; env changes are picked up because the key includes
    the resolved settings.
    """

    def __init__(self):
        self._clients: Dict[Tuple, ChatOpenAI] = {}
        self._lock = threading.Lock()

    def get_int_env_value(self, name: str, default: int) -> int:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            return int(raw)
        except ValueError:
            return default

    def _build(self, model: str, temperature: float, max_tokens: int,
               timeout: int, max_retries: int) -> ChatOpenAI:
        key = (model, temperature, max_tokens, timeout, max_retries, os.getenv("OPENAI_API_KEY", "")[-8:])
        with self._lock:
            client = self._clients.get(key)
            if client is None:
                kwargs = dict(
                    api_key=os.getenv("OPENAI_API_KEY"),
                    model=model,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    max_retries=max_retries,
                )
                # Reasoning models (gpt-5*, o-series) reject custom temperature.
                if not model.startswith(("gpt-5", "o1", "o3", "o4")):
                    kwargs["temperature"] = temperature
                client = ChatOpenAI(**kwargs)
                self._clients[key] = client
            return client

    def get_llm(self) -> ChatOpenAI:
        """Main synthesis model (long, formatted legal answers)."""
        return self._build(
            model=os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
            temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.1")),
            max_tokens=self.get_int_env_value("OPENAI_MAX_TOKENS", 4096),
            timeout=self.get_int_env_value("OPENAI_REQUEST_TIMEOUT", 60),
            max_retries=self.get_int_env_value("OPENAI_MAX_RETRIES", 3),
        )

    def get_assess_llm(self) -> ChatOpenAI:
        """Small deterministic model for the relevance gate and intent classifier."""
        return self._build(
            model=os.getenv("OPENAI_ASSESS_MODEL") or os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
            temperature=0.0,
            # Room for a verdict + one evidence quote per document for up to ~8 documents;
            # a truncated reply is unparseable and makes the gate fail open.
            max_tokens=800,
            timeout=30,
            max_retries=2,
        )

    def get_understand_llm(self) -> ChatOpenAI:
        """Query understanding (intent, follow-up type, language, English search query).
        Returns a small JSON object, so a short token cap keeps it fast."""
        return self._build(
            model=os.getenv("OPENAI_UNDERSTAND_MODEL") or os.getenv("OPENAI_ASSESS_MODEL") or os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
            temperature=0.0,
            max_tokens=600,
            timeout=30,
            max_retries=2,
        )

    def get_verify_llm(self) -> ChatOpenAI:
        """Answer self-check: reads the draft beside its sources and returns corrections."""
        return self._build(
            model=os.getenv("OPENAI_VERIFY_MODEL") or os.getenv("OPENAI_ASSESS_MODEL") or os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
            temperature=0.0,
            max_tokens=4000,
            timeout=45,
            max_retries=2,
        )

    def warm_up(self) -> None:
        """Open the HTTPS connections at startup so the first question doesn't pay for them."""
        for client in (self.get_llm(), self.get_assess_llm(), self.get_understand_llm(), self.get_verify_llm()):
            try:
                client.invoke("ping", max_tokens=1)
            except Exception as exc:  # network/API issues surface on the first real call instead
                print(f"⚠️ OpenAI warm-up failed ({exc.__class__.__name__}): {str(exc)[:120]}")


llm_service = LLMService()


def get_llm() -> ChatOpenAI:
    return llm_service.get_llm()
