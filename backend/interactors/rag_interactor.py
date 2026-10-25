from typing import List, Optional
from backend.services.agent import agent_service
from backend.services.cache import cache_service
from backend.schemas import ChatResponse, SourceDocument


def _resolve_image_url(raw: Optional[str]) -> Optional[str]:
    """Return a usable image URL. HTTP(S) links pass through unchanged; local
    paths are served from the mounted /data directory. (Fixes the old
    `"/data/" + x.lstrip("data/")` bug, which stripped characters, not a prefix.)"""
    img = (raw or "").strip()
    if not img:
        return None
    if img.startswith("http://") or img.startswith("https://"):
        return img
    # normalize a local path to be served under /data
    img = img.lstrip("/")
    if not img.startswith("data/"):
        img = "data/" + img
    return "/" + img


class RAGInteractor:
    def retrieve_and_generate(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        filters: Optional[dict] = None,
    ) -> ChatResponse:
        """
        Main entry point for the agentic RAG system.
        Called by the /chat route.

        Runs the agent pipeline and returns a fully-formed ChatResponse.
        
        Caching Strategy:
        - If same query exists in cache (and TTL not expired), return cached answer immediately
        - Otherwise, run full agent pipeline and cache result
        """
        if not conversation_history:
            cached = cache_service.get_cached_answer(query, filters)
            if cached:
                sources = [
                    SourceDocument(
                        content=src.get("content"),
                        doc_type=src.get("doc_type"),
                        title=src.get("title"),
                        judge_name=src.get("judge_name"),
                        court=src.get("court"),
                        year=src.get("year"),
                        score=src.get("score"),
                        pdf_url=src.get("pdf_url"),
                        image_url=_resolve_image_url(src.get("image_url")),
                    )
                    for src in cached.get("sources", [])
                ]
                return ChatResponse(
                    answer=cached["answer"],
                    sources=sources,
                    query=cached["query"],
                    agent_trace=["✨ Retrieved from cache (no re-processing needed)"],
                )
        
        result = agent_service.run_agent(
            query=query,
            conversation_history=conversation_history or [],
            filters=filters,
        )

        sources = [
            SourceDocument(
                content=src.get("content"),
                doc_type=src.get("doc_type"),
                title=src.get("title"),
                judge_name=src.get("judge_name"),
                court=src.get("court"),
                year=src.get("year"),
                score=src.get("score"),
                pdf_url=src.get("pdf_url"),
                image_url=_resolve_image_url(src.get("image_url")),
            )
            for src in result.get("sources", [])
        ]
        
        response = ChatResponse(
            answer=result["answer"],
            sources=sources,
            query=result["query"],
            agent_trace=result.get("agent_trace", []),
        )
        
        if not conversation_history:
            cache_service.set_cached_answer(
                query=query,
                answer=response.answer,
                sources=[
                    {
                        "content": src.content,
                        "doc_type": src.doc_type,
                        "title": src.title,
                        "judge_name": src.judge_name,
                        "court": src.court,
                        "year": src.year,
                        "score": src.score,
                        "pdf_url": src.pdf_url,
                        "image_url": src.image_url,
                    }
                    for src in sources
                ],
                filters=filters,
            )

        return response
