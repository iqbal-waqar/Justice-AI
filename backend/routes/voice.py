from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.services.speech import SpeechError, speech_service

router = APIRouter()

MAX_AUDIO_BYTES = 10 * 1024 * 1024


@router.post("/voice/transcribe")
def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    current_user: User = Depends(auth_interactor.resolve_current_user),
):
    data = audio.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="No audio received.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Recording is too long. Please keep questions under a few minutes.")
    try:
        result = speech_service.transcribe(
            data, audio.filename or "question.webm", audio.content_type or "audio/webm",
            language if language in ("auto", "ur", "en") else "auto",
        )
    except SpeechError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    if not result["text"]:
        raise HTTPException(status_code=422, detail="No speech was detected. Please try again, a little closer to the microphone.")
    return result
