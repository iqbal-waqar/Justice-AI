"""Answer-language support (English, Urdu, Roman Urdu).

Working out what language a message is in, whether the user asked for a
particular language, and the English search query is done by the model in the
query-understanding step (nodes.understand_query) — not by word lists. This
module only holds what happens after that decision: the instructions that make
the answer come out in the chosen language, and translation of fixed replies.

Answer-language codes: "en", "ur" (Urdu, Nastaliq script), "roman" (Roman Urdu).
"""
import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from backend.services.llm import llm_service

LANGUAGE_CODES = ("en", "ur", "roman")
LANGUAGE_NAMES = {"en": "English", "ur": "Urdu (Nastaliq script)", "roman": "Roman Urdu"}

# Unicode script share — used only to decide whether an already-written reply
# needs translating (not to interpret what the user meant).
_URDU_CHAR_RE = re.compile(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]")
_LATIN_CHAR_RE = re.compile(r"[A-Za-z]")


def urdu_ratio(text: str) -> float:
    urdu = len(_URDU_CHAR_RE.findall(text or ""))
    latin = len(_LATIN_CHAR_RE.findall(text or ""))
    return urdu / (urdu + latin) if urdu + latin else 0.0


def choose_answer_language(preference: Optional[str], message_language: Optional[str],
                           requested: Optional[str]) -> str:
    """Pick the answer language.

    requested   – a language the user explicitly asked for in this message (wins)
    preference  – the chat toggle: "ur" forces Urdu, "en" forces English, "auto" mirrors
    message_language – the language the message is written in
    """
    if requested in LANGUAGE_CODES:
        return requested
    pref = (preference or "auto").lower()
    if pref in ("ur", "en"):
        return pref
    return message_language if message_language in LANGUAGE_CODES else "en"


URDU_ANSWER_INSTRUCTION = (
    "\n\nLANGUAGE: Write the ENTIRE answer in clear, formal Urdu (Nastaliq script), the register a "
    "Pakistani lawyer would use. Exceptions that must stay in English exactly as in the sources: "
    "case names (still in *italics* with the citation in parentheses right after, e.g. "
    "*Alam Khan v. The State* (2021 LHC 3221)), citations, court names on first mention, statute "
    "names and abbreviations (PPC, Cr.P.C.), and section/article numbers. Write every number with "
    "Western digits (0-9), never Urdu digits. Keep the same structure and Markdown formatting."
)

ROMAN_URDU_ANSWER_INSTRUCTION = (
    "\n\nLANGUAGE: Write the ENTIRE answer in Roman Urdu — Urdu written in English letters, the "
    "way Pakistani lawyers text each other (e.g. \"Is case mein adalat ne kaha ke zamanat qanooni "
    "haq hai\"). Keep legal terms lawyers use in English where natural (bail, FIR, khula, "
    "maintenance, prohibitory clause). Case names stay in *italics* with the citation in parentheses "
    "right after, e.g. *Alam Khan v. The State* (2021 LHC 3221); keep citations, court names, statute "
    "names and section numbers exactly as in the sources. Keep the same structure and Markdown."
)

LANGUAGE_INSTRUCTIONS = {"ur": URDU_ANSWER_INSTRUCTION, "roman": ROMAN_URDU_ANSWER_INSTRUCTION}

_TRANSLATE_SYSTEM = {
    "ur": (
        "Translate the following Markdown text into clear, formal Urdu (Nastaliq script). Keep the "
        "Markdown structure exactly. Keep in English: case names, citations, court names, statute "
        "names and abbreviations (PPC, Cr.P.C.), section and article numbers, and URLs. Use Western "
        "digits (0-9). Output only the translation."
    ),
    "roman": (
        "Rewrite the following Markdown text in Roman Urdu (Urdu written in English letters, as "
        "Pakistanis text). Keep the Markdown structure exactly. Keep case names, citations, court "
        "names, statute names, section numbers and URLs unchanged. Output only the rewritten text."
    ),
}


def localize(text: str, lang: str) -> str:
    """Translate a fixed English reply (not-covered notice, fallback) into the answer
    language. Returns the input unchanged for English or if translation fails."""
    system = _TRANSLATE_SYSTEM.get(lang)
    if not text or not system:
        return text
    if lang == "ur" and urdu_ratio(text) >= 0.3:
        return text
    try:
        resp = llm_service.get_llm().invoke([SystemMessage(content=system), HumanMessage(content=text)])
        out = (resp.content or "").strip()
        if out:
            return out
    except Exception as exc:
        print(f"⚠️ Reply translation failed ({exc.__class__.__name__}) — replying in English")
    return text
