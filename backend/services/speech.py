"""Speech-to-text for voice questions (ElevenLabs Scribe).

The browser records the question and uploads the audio; we return the
transcript, which the user can check and edit before sending it as a normal
chat message. Answers stay as text.

Env: ELEVENLABS_API_KEY (required), ELEVENLABS_STT_MODEL (default scribe_v1).
"""
import os
import re
from typing import Optional

import requests

STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
_DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")


class SpeechError(Exception):
    """Transcription failed; the message is safe to show to the user."""


class SpeechService:
    def __init__(self):
        self._session = requests.Session()  # keep-alive across requests

    @property
    def configured(self) -> bool:
        return bool(os.getenv("ELEVENLABS_API_KEY", "").strip())

    def _call(self, audio: bytes, filename: str, content_type: str, language_code: Optional[str]) -> dict:
        data = {
            "model_id": os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1"),
            "tag_audio_events": "false",   # no "[laughter]" / "[music]" labels in the text
            "diarize": "false",
        }
        if language_code:
            data["language_code"] = language_code
        try:
            resp = self._session.post(
                STT_URL,
                headers={"xi-api-key": os.getenv("ELEVENLABS_API_KEY", "").strip()},
                data=data,
                files={"file": (filename, audio, content_type or "application/octet-stream")},
                timeout=60,
            )
        except requests.RequestException as exc:
            raise SpeechError("Could not reach the transcription service. Please try again.") from exc
        if resp.status_code == 401:
            raise SpeechError("The voice service key is invalid or lacks speech-to-text permission.")
        if resp.status_code == 402 or "quota" in resp.text.lower():
            raise SpeechError("Voice credits are used up for this month.")
        if resp.status_code >= 400:
            raise SpeechError(f"Transcription failed ({resp.status_code}).")
        return resp.json()

    def transcribe(self, audio: bytes, filename: str, content_type: str, language: str = "auto") -> dict:
        """language: "ur" forces Urdu, "en" forces English, "auto" detects.
        Returns {"text", "language_code", "duration_secs"}."""
        if not self.configured:
            raise SpeechError("Voice input is not configured on the server.")
        forced = {"ur": "urd", "en": "eng"}.get(language)
        result = self._call(audio, filename, content_type, forced)

        # Spoken Urdu and Hindi are nearly identical, so auto-detection can return
        # Urdu speech in Devanagari script. Our users write Urdu, so redo it as Urdu.
        if not forced and _DEVANAGARI_RE.search(result.get("text", "")):
            result = self._call(audio, filename, content_type, "urd")

        return {
            "text": " ".join((result.get("text") or "").split()),
            "language_code": result.get("language_code"),
            "duration_secs": result.get("audio_duration_secs"),
        }


speech_service = SpeechService()
