import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from backend.schemas import ChatRequest
from backend.services.agent import agent_service
from backend.services.cache import cache_service
from backend.interactors.auth_interactor import auth_interactor
from backend.database.migrations.user import User

router = APIRouter()


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
):
    history = request.conversation_history or []

    def sse(ev):
        return f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    def event_gen():
        if not history:
            cached = cache_service.get_cached_answer(request.query, request.cache_filters())
            if cached:
                yield sse({"type": "status", "content": "⚡ Found a saved answer to this exact question"})
                words = cached["answer"].split(" ")
                for i in range(0, len(words), 12):
                    yield sse({"type": "token", "content": " ".join(words[i:i + 12]) + (" " if i + 12 < len(words) else "")})
                yield sse({"type": "final", "content": cached["answer"]})
                yield sse({"type": "sources", "sources": cached.get("sources", [])})
                yield sse({"type": "done"})
                return

        final_answer, sources = "", []
        try:
            for ev in agent_service.stream_agent(
                query=request.query,
                conversation_history=history,
                filters=request.filters,
                language=request.language,
            ):
                if ev.get("type") == "final":
                    final_answer = ev.get("content", "")
                elif ev.get("type") == "sources":
                    sources = ev.get("sources", [])
                yield sse(ev)
        except Exception as e:
            yield sse({"type": "error", "message": str(e)[:300]})
            return

        if not history and cache_service.should_cache(final_answer, sources):
            cache_service.set_cached_answer(request.query, final_answer, sources, request.cache_filters())

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
