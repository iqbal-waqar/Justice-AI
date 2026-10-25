import json

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from backend.schemas import ChatRequest, ChatResponse
from backend.interactors.rag_interactor import RAGInteractor
from backend.services.agent import agent_service
from backend.interactors.auth_interactor import auth_interactor
from backend.database.migrations.user import User

router = APIRouter()
interactor = RAGInteractor()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
):
    try:
        return interactor.retrieve_and_generate(
            query=request.query,
            conversation_history=request.conversation_history or [],
            filters=request.filters,
        )
    except Exception as e:
        msg = str(e)
        lowered = msg.lower()
        if "rate limit" in lowered or "rate_limit" in lowered or "429" in lowered:
            raise HTTPException(status_code=503, detail="LLM provider is currently rate-limited. Please retry shortly.")
        if "timeout" in lowered or "timed out" in lowered:
            raise HTTPException(status_code=504, detail="Request timed out while generating the legal response. Please retry.")
        raise HTTPException(status_code=500, detail=f"Agent pipeline error: {msg}")


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
):
    """Server-Sent Events stream of the answer as it's generated.

    Emits JSON events: {type:'token',content}, {type:'final',content},
    {type:'sources',sources}, {type:'done'}, or {type:'error',message}.
    """
    def event_gen():
        try:
            for ev in agent_service.stream_agent(
                query=request.query,
                conversation_history=request.conversation_history or [],
                filters=request.filters,
            ):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)[:300]})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering (nginx)
        },
    )
