import os
from langchain_groq import ChatGroq


class LLMService:
    def get_int_env_value(self, name: str, default: int) -> int:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            return int(raw)
        except ValueError:
            return default

    def get_llm(self) -> ChatGroq:
        model = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-20b")
        kwargs = dict(
            api_key=os.getenv("GROQ_API_KEY"),
            model=model,
            temperature=float(os.getenv("GROQ_TEMPERATURE", "0.1")),
            max_tokens=self.get_int_env_value("GROQ_MAX_TOKENS", 4096),
            max_retries=self.get_int_env_value("GROQ_MAX_RETRIES", 3),
            request_timeout=self.get_int_env_value("GROQ_REQUEST_TIMEOUT", 60),
        )
        # gpt-oss are reasoning models: without capping reasoning they can spend the
        # whole token budget "thinking" and return EMPTY content. Keep reasoning low
        # so the final answer always comes through.
        if "gpt-oss" in model:
            kwargs["reasoning_effort"] = os.getenv("GROQ_REASONING_EFFORT", "low")
        return ChatGroq(**kwargs)


llm_service = LLMService()


def get_llm() -> ChatGroq:
    return llm_service.get_llm()