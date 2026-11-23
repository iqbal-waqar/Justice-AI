import json
import os
import re
from datetime import datetime
from typing import Annotated, List, Optional, Literal, TypedDict

from pydantic import BaseModel, Field
import warnings

# LangChain's structured-output parser re-serialises the parsed model and pydantic
# warns about the declared type; the parsed value itself is correct.
warnings.filterwarnings("ignore", message=r"Pydantic serializer warnings")

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    BaseMessage,
)
from langgraph.graph.message import add_messages

from backend.services.llm import llm_service
from backend.services.tools import (
    SEARCH_UNAVAILABLE, _EXCERPT_STOPWORDS, _map_court_to_case_doc_types, focused_excerpt, prefetch_case_search,
)
from backend.services.prompts import format_conversation_history
from backend.services.language import (
    LANGUAGE_INSTRUCTIONS, LANGUAGE_NAMES, choose_answer_language, localize, urdu_ratio,
)


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]

    original_query: str

    # Standalone, history-resolved version of original_query used for retrieval.
    search_query: str

    query_intent: str

    query_variants: List[str]

    retry_count: int

    results_sufficient: bool

    final_answer: str

    sources_summary: str

    conversation_history: List[dict]

    filters: Optional[dict]

    agent_trace: List[str]

    # Indian→Pakistani provision corrections applied to the query (shown to user).
    corrections: List[str]

    # Relevance gate output: which retrieved docs actually address the question.
    answerable: bool
    relevant_doc_ids: Optional[List[int]]
    assessment_reason: str
    assessment_verdict: str

    # Decision years to restrict case-law search to (None = all years).
    search_years: Optional[List[str]]

    # Bilingual support: "en" | "ur" for the answer; english_query is the
    # English form of original_query (translated when the user wrote Urdu).
    answer_language: str
    english_query: str
    # True when the user only asked to restate the previous answer in another language.
    restate_previous: bool
    # Set by the query-understanding step.
    language_preference: str            # chat toggle: "auto" | "en" | "ur"
    search_doc_types: Optional[List[str]]  # courts/collections the user limited the search to
    multi_part: bool                    # several distinct legal questions in one message
    targeted_case: bool                 # follow-up about one case cited earlier
    judge_args: Optional[dict]          # judge_profile: request kind / name / courts / status
    search_failed: bool                 # the search service itself was unreachable
    # The passages the answer was written from, one per judgment / statute
    # (read by the evaluation in evaluation/; not shown to the user).
    answer_contexts: List[str]
    # How shorthand in the question was read ("751" → Sections 107/151 Cr.P.C.), shown above the answer.
    interpretation: Optional[str]
    # A question back to the user when a cited provision could not be resolved.
    clarification: Optional[str]
    # Corrections the self-check made to the drafted answer (shown in the trace).
    answer_corrections: List[dict]


def extract_provision_markers(text: str) -> List[str]:
    markers: List[str] = []
    for _, token in _SECTION_REF_RE.findall(text):
        cleaned = token.strip().lower()
        if cleaned:
            markers.append(cleaned)
    for token in _ARTICLE_REF_RE.findall(text):
        cleaned = token.strip().lower()
        if cleaned:
            markers.append(cleaned)
    return list(dict.fromkeys(markers))


# ------- Retrieved-document block helpers (shared by gate + synthesis) -------
_DOC_HDR_RE = re.compile(r"\[Doc (\d+) of (\d+)\]")


def latest_tool_outputs(messages: List[BaseMessage]) -> List[str]:
    """ToolMessages produced after the most recent dispatch (ignores stale retries)."""
    last_dispatch_idx = -1
    for i, msg in enumerate(messages):
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            last_dispatch_idx = i
    start = last_dispatch_idx + 1 if last_dispatch_idx >= 0 else 0
    return [m.content for m in messages[start:] if isinstance(m, ToolMessage)]


def split_doc_blocks(text: str):
    """Split _format_results output into (preamble, [(printed_doc_num, block_text), …])."""
    starts = [(m.start(), int(m.group(1))) for m in _DOC_HDR_RE.finditer(text)]
    if not starts:
        return text, []
    preamble = text[:starts[0][0]]
    blocks, seen = [], set()
    for i, (s, n) in enumerate(starts):
        e = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        body = text[s:e].rstrip()
        if body.endswith("---"):
            body = body[:-3].rstrip()
        # A retry searches two phrasings, so the same case can come back twice.
        header = body.split("\n", 1)[0]
        key = _DOC_HDR_RE.sub("", header.split("| score=")[0]).strip().lower()
        if key in seen:
            continue
        seen.add(key)
        blocks.append((n, body))
    return preamble, blocks


def rebuild_context(blocks, preamble_note: str = "") -> str:
    """Re-number blocks 1..N (retries can repeat numbers) and rebuild the context."""
    n = len(blocks)
    out = []
    for i, (_, body) in enumerate(blocks, 1):
        out.append(_DOC_HDR_RE.sub(f"[Doc {i} of {n}]", body, count=1))
    return f"=== {n} RETRIEVED DOCUMENTS ===\n{preamble_note}" + "\n---\n".join(out)


def budget_context(blocks, max_total: Optional[int] = None, min_per_doc: int = 1800, query: str = ""):
    """Fit documents into the LLM budget WITHOUT silently hiding whole documents.

    The old code cut the concatenated string at 6,000 chars, so docs 3–4 vanished
    while the prompt still claimed four documents. Now each doc gets an even share
    (truncated at the end, visibly marked) and only docs that fit are passed —
    the count the prompt reports is the count the model can actually read.
    CONTEXT_MAX_TOTAL_CHARS (default 30000 ≈ 7.5k tokens, ~10 full documents)
    controls the total; lower it if the provider has tight per-minute limits.
    """
    if not blocks:
        return blocks
    max_total = max_total or int(os.getenv("CONTEXT_MAX_TOTAL_CHARS", "30000"))
    per_doc = max(min_per_doc, max_total // len(blocks))
    kept, used = [], 0
    for n, body in blocks:
        if len(body) > per_doc:
            # Keep the header, and from the passage the part that matters for the
            # question (a provision it names, or its densest stretch) — not just the start.
            cut = body.find("[PASSAGE]\n")
            if query and cut != -1 and per_doc - (cut + 10) > 600:
                head = body[:cut + 10]
                body = head + focused_excerpt(body[cut + 10:], query, per_doc - len(head) - 2)
            else:
                body = body[:per_doc].rstrip() + "\n…[passage truncated]"
        if kept and used + len(body) > max_total:
            break
        kept.append((n, body))
        used += len(body)
    return kept


# ------- Year filters ("judgments from 2020", "between 2018 and 2021") -------
MIN_YEAR, MAX_YEAR = 1947, datetime.now().year
def _year_list(start: int, end: int) -> Optional[List[str]]:
    start, end = max(start, MIN_YEAR), min(end, MAX_YEAR)
    if start > end or end - start > 40:
        return None
    return [str(y) for y in range(start, end + 1)]


# ------- Follow-up rewrite validation -------
_PROV_PAIR_RE = re.compile(
    r"\b(?:sections?|s\.|u/s|articles?|art\.)\s*(\d{1,4}(?:\s*-\s*[a-z])?)"
    r"(?:\s*(?:,|\(|of\s+the|of)?\s*(ppc|p\.p\.c|pakistan penal code|cr\.?\s*p\.?\s*c|crpc|criminal procedure|"
    r"cpc|c\.p\.c|civil procedure|constitution|qso|qanun))?",
    re.I,
)


def _canon_statute(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    c = re.sub(r"[\s\.]", "", code.lower())
    if c in ("ppc", "pakistanpenalcode"):
        return "ppc"
    if c in ("crpc", "criminalprocedure"):
        return "crpc"
    if c in ("cpc", "civilprocedure"):
        return "cpc"
    if c.startswith("constitution"):
        return "constitution"
    if c.startswith("q"):
        return "qso"
    return c


def _provision_pairs(text: str) -> set:
    return {(re.sub(r"\s", "", n).lower(), _canon_statute(code)) for n, code in _PROV_PAIR_RE.findall(text or "")}


def validate_rewrite(rewrite: str, query: str, history: List[dict]) -> Optional[str]:
    """Reject a follow-up rewrite that invents a provision or moves one to a
    different statute (e.g. "Section 497 CrPC" → "Section 497 PPC").
    Returns a reason string if invalid, else None."""
    source = query + " " + " ".join(m.get("content", "") for m in history)
    src_pairs = _provision_pairs(source)
    # Any number written in the conversation counts as mentioned — Urdu text
    # ("دفعہ 302") carries provision numbers without the English word "section".
    src_nums = {n for n, _ in src_pairs} | {re.sub(r"\s", "", t).lower() for t in re.findall(r"\d{1,4}(?:\s*-\s*[A-Za-z])?", source)}
    for num, code in _provision_pairs(rewrite):
        if num not in src_nums:
            return f"introduced provision {num} not in the conversation"
        known_codes = [c for n, c in src_pairs if n == num]
        if code and known_codes and all(known_codes) and (num, code) not in src_pairs:
            known = sorted(set(known_codes))
            return f"moved section {num} to {code.upper()} (conversation says {', '.join(k.upper() for k in known)})"
    return None


# ------- Query understanding (one model call; no keyword lists) -------
# The model's reply is constrained by a strict JSON schema (enums cannot be
# violated) and guided by worked examples. Arithmetic on years is done in code
# from the kind of time expression the model reports.

class _TimeFilter(BaseModel):
    kind: Literal["single_year", "since_year", "year_range", "last_n_years"]
    year: Optional[int] = Field(description="single_year / since_year: the year. year_range: the first year.")
    end_year: Optional[int] = Field(description="year_range only: the last year.")
    n: Optional[int] = Field(description="last_n_years only: how many years.")


class QueryUnderstanding(BaseModel):
    intent: Literal["conversational", "out_of_scope", "case_law", "statutory_law", "judge_profile"]
    followup: Literal["none", "translate_previous", "from_conversation", "cited_case"]
    referenced_case: Optional[str] = Field(description="cited_case only: the case name and citation exactly as written in the conversation.")
    message_language: Literal["en", "ur", "roman"] = Field(description="Language the NEW MESSAGE is written in. roman = Urdu written in English letters.")
    explicit_language_request: Optional[Literal["en", "ur", "roman"]] = Field(
        description="ONLY if the NEW MESSAGE itself contains words asking for a language (\"in English\", \"urdu mein\", \"roman urdu mai\"). Otherwise null.")
    search_query: str = Field(description="ALWAYS in English. Empty for conversational / out_of_scope / translate_previous / from_conversation.")
    alternative_queries: List[str]
    indian_provision_notes: List[str]
    court_words: Optional[str] = Field(
        description="The exact words, copied character for character from the NEW MESSAGE, that name the court(s) to search or ask "
                    "to keep the court used before (e.g. \"Supreme Court\", \"LHC ke\", \"same court\"). Null when the NEW MESSAGE has no such words.")
    courts_named_by_user: List[Literal["supreme_court", "lahore_high_court", "islamabad_high_court", "district_courts"]] = Field(
        description="Only courts the user explicitly names to restrict the search. Empty list = all courts. "
                    "district_courts = the trial and first-appeal courts of a district (District & Sessions Judge, Additional Sessions Judge, Civil Judge, Family Court), e.g. \"Sahiwal courts\", \"sessions court\", \"civil court ke faislay\".")
    time_words: Optional[str] = Field(
        description="The exact words, copied character for character from the NEW MESSAGE, that ask for judgments of particular "
                    "years (e.g. \"from 2020\", \"pichle 3 saal\", \"same years\"). Null when the NEW MESSAGE has no such words.")
    time_filter: Optional[_TimeFilter] = Field(description="Only for the DECISION years of judgments the user asks for in the NEW MESSAGE. Null otherwise.")
    multi_part: bool
    judge_request: Literal["none", "named_judge", "chief_justice", "list", "describe"] = Field(
        description="judge_profile only, otherwise none. named_judge = about one judge named by the user. "
                    "chief_justice = who is / was the Chief Justice of a court. list = a list of judges of a court. "
                    "describe = find judges by a description (education, career, background) without naming one.")
    judge_name: Optional[str] = Field(description="named_judge only: the judge's name as the user wrote it, without titles such as Justice / Mr. / Chief Justice.")
    judge_status: Literal["any", "sitting", "former"] = Field(
        description="judge_profile only: sitting = current / serving judges, former = retired or past judges, any = not specified.")


UNDERSTAND_SYSTEM = """You are the query-understanding step of Justice AI, a legal research assistant for Pakistani lawyers. Its search engine holds English-language judgments of the Supreme Court of Pakistan, Lahore High Court and Islamabad High Court, judgments of Punjab district courts (currently Sahiwal, Okara, Pakpattan, Kasur and Rawalpindi), federal and Punjab statutes, and judge profiles. Messages may be in English, Urdu (Nastaliq script) or Roman Urdu, with typos.

intent
- conversational: greetings, thanks, goodbyes, small talk, questions about the assistant, or asking for help without stating the legal issue yet.
- out_of_scope: not about law or the legal system (weather, sports, recipes...), even if words like "court" are used in a non-legal sense.
- Court practice and procedure — court hours, filing and presentation, process and summons, court-fee, adjournments, records, copies, the duties of judges and court staff, and the High Court Rules and Orders — is legal (statutory_law), never out_of_scope.
- statutory_law: what a specific Act / Ordinance / Code / section / article says or provides.
- judge_profile: about a specific judge as a person, or a list of judges of a court.
- case_law: every other legal question — rights, remedies, offences, bail, procedure, precedent, legal advice.

followup — only when there IS an earlier conversation; otherwise "none"
- translate_previous: the message only asks for the previous answer again in another language or script. Nothing new is asked.
- from_conversation: asks to explain, simplify, shorten, summarise or reformat what was already answered.
- cited_case: asks for more about ONE specific case cited earlier (put it in referenced_case).
- none: a new question, or a follow-up that needs new research (new facts, a different issue).
For translate_previous / from_conversation / cited_case, intent is the intent of the conversation's legal topic (usually case_law).

search_query (case_law / statutory_law / judge_profile with followup none; otherwise "")
- One standalone English search query, resolving references to the conversation. NEVER in Urdu.
- Translate Urdu / Roman Urdu into precise Pakistani legal English (ضمانت قبل از گرفتاری → pre-arrest bail, خلع → khula, نان نفقہ → maintenance, mulzim → accused).
- Name the statute of a provision the user left implicit when the topic or standard Pakistani usage makes it clear ("section 302" in a murder or bail question → "Section 302 PPC").
- If the message is already a clear, self-contained English legal question needing none of the above, copy it exactly.
- Never introduce a provision number the user did not mention or clearly imply.
- judge_profile: "Justice <full name as given>" for one judge; for lists e.g. "current judges of Islamabad High Court".
judge_request / judge_name / judge_status (judge_profile only): see the field descriptions. "Who is the Chief Justice of X" (present tense) → chief_justice with judge_status sitting. Put the court in courts_named_by_user.
indian_provision_notes: for each Indian provision the user cites (e.g. Section 482 CrPC, Section 438 CrPC, Article 226, the IPC, Section 138 NI Act), search for the Pakistani equivalent and add one note such as "Section 482 CrPC is an Indian provision; in Pakistan the High Court's inherent power to quash proceedings is **Section 561-A Cr.P.C. 1898**". Otherwise []. A note is ONLY for a provision that belongs to Indian law and not to Pakistani law. Pakistan has its own Cr.P.C. 1898, PPC 1860, CPC 1908 and Constitution of 1973, and many of their section numbers match everyday Pakistani practice (Sections 497 and 498 Cr.P.C. on bail, 561-A Cr.P.C., 302 and 489-F PPC, Article 199). A provision that is valid Pakistani law is never "Indian" — when in doubt, add no note.
alternative_queries: 1-2 differently worded English searches for the same legal point; [] when search_query is "".
time_filter: "from 2020" / "in 2020" / "2020 judgments" → single_year 2020. "since 2020" / "after 2020" / "2020 onwards" → since_year 2020. "between 2018 and 2019" / "2018-2019" → year_range 2018..2019. "last 3 years" / "pichle 3 saal" → last_n_years 3. A statute's year ("Contract Act 1872") or a citation's year ("PLD 2021 SC 708") is NOT a time filter.
courts_named_by_user and time_filter limit the search, so they come ONLY from the NEW MESSAGE: fill them when its own words name a court or years, or ask to keep the earlier ones, and copy those words into court_words / time_words. Courts, years and citations that merely appear in earlier answers are not a request to limit the search. A follow-up that names no court is searched across all courts.
multi_part: true if the message asks several distinct legal questions at once.

EXAMPLES (abbreviated: fields not shown are none / null / [] / false)
- "hello" → conversational, message_language en
- "السلام علیکم" → conversational, message_language ur
- "aaj mausam kaisa hai" → out_of_scope, message_language roman
- "What are the court hours for civil courts?" → statutory_law, search_query "court hours of civil courts under the Lahore High Court Rules and Orders"
- "Supreme Court judgments from 2020 on service matters" → case_law, search_query copied exactly, courts_named_by_user [supreme_court], time_filter single_year 2020
- "pichle 3 saal ke LHC ke faislay khula par" → case_law, message_language roman, explicit_language_request null, search_query "Lahore High Court judgments on khula", courts [lahore_high_court], time_filter last_n_years 3
- "قتل کے مقدمے میں دفعہ 302 کے تحت ضمانت کیسے ملتی ہے؟" → case_law, message_language ur, explicit_language_request null, search_query "grounds for post-arrest bail under Section 302 PPC in a murder case", courts []
- "can I file under section 482 CrPC to quash FIR" → case_law, search_query "quashing an FIR under Section 561-A Cr.P.C.", indian_provision_notes [one note]
- "who is Justice Athar Minallah" → judge_profile, judge_request named_judge, judge_name "Athar Minallah", search_query "Justice Athar Minallah"
- "Lahore High Court ke maujooda Chief Justice kaun hain" → judge_profile, message_language roman, judge_request chief_justice, judge_status sitting, courts [lahore_high_court]
- "list the former judges of Islamabad High Court" → judge_profile, judge_request list, judge_status former, courts [islamabad_high_court]
- "grounds for pre-arrest bail under section 498 CrPC" → case_law, search_query copied exactly, indian_provision_notes [] (Section 498 Cr.P.C. is Pakistani law)
- after an answer: "roman urdu mai btao" → followup translate_previous, explicit_language_request roman
- after an answer: "isay asaan alfaaz mein samjhao" → followup from_conversation, message_language roman, explicit_language_request null
- after an answer citing *Mst. Ghazala v. The State* (2023 SCMR 887): "tell me more about the Ghazala case" → case_law, followup cited_case, referenced_case "Mst. Ghazala v. The State (2023 SCMR 887)"
- after an answer that cited only Lahore High Court judgments from 2021-2025: "does the court decide the amount?" → case_law, followup none, court_words null, courts [], time_words null, time_filter null (the new message names no court or year)
- after the same answer: "what has the Supreme Court said on this?" → court_words "Supreme Court", courts [supreme_court]
- after an answer on 302 bail: "aur agar mulzim aurat ho?" → case_law, followup none, message_language roman, search_query "post-arrest bail for a female accused in a Section 302 PPC murder case\""""

_COURT_DOC_TYPES = {"supreme_court": "sc_case", "lahore_high_court": "lhc_case", "islamabad_high_court": "isb_case",
                    "district_courts": "district_case"}


def _recent_conversation(history: List[dict], turns: int = 6, max_answer: int = 1800) -> str:
    lines = []
    for m in history[-turns:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        text = (m.get("content") or "")[: (max_answer if role == "Assistant" else 600)]
        lines.append(f"{role}: {text}")
    return "\n\n".join(lines)


def _years_from_filter(tf: Optional[_TimeFilter]) -> Optional[List[str]]:
    if tf is None:
        return None
    if tf.kind == "single_year" and tf.year:
        return _year_list(tf.year, tf.year)
    if tf.kind == "since_year" and tf.year:
        return _year_list(tf.year, MAX_YEAR)
    if tf.kind == "year_range" and tf.year and tf.end_year:
        return _year_list(min(tf.year, tf.end_year), max(tf.year, tf.end_year))
    if tf.kind == "last_n_years" and tf.n and tf.n > 0:
        return _year_list(MAX_YEAR - tf.n + 1, MAX_YEAR)
    return None


def _quoted_in_message(quote: Optional[str], message: str) -> bool:
    """True when the words the model says it copied really are in the user's message.
    A court or year limit is applied only with such proof, so a court that merely
    appeared in an earlier answer can never narrow the search."""
    norm = lambda t: " ".join(re.sub(r"[^\w\s]", " ", (t or "").casefold()).split())
    q, m = norm(quote), norm(message)
    if not q:
        return False
    if q in m:
        return True
    words = q.split()
    return sum(w in m.split() for w in words) / len(words) >= 0.8


def _same_words(a: Optional[str], b: Optional[str]) -> bool:
    """True when two quotes are (nearly) the same stretch of the message."""
    ta = set(re.sub(r"[^\w\s]", " ", (a or "").casefold()).split())
    tb = set(re.sub(r"[^\w\s]", " ", (b or "").casefold()).split())
    return bool(ta and tb) and len(ta & tb) / min(len(ta), len(tb)) >= 0.6


def llm_understand(query: str, history: List[dict]) -> Optional[dict]:
    """Interpret the message with the model. Returns a dict, or None if the call fails."""
    convo = _recent_conversation(history) if history else "(no earlier conversation)"
    try:
        u: QueryUnderstanding = llm_service.get_understand_llm().with_structured_output(
            QueryUnderstanding, method="json_schema", strict=True,
        ).invoke([
            SystemMessage(content=UNDERSTAND_SYSTEM + f"\nThe current year is {MAX_YEAR}."),
            HumanMessage(content=f"CONVERSATION:\n{convo}\n\nNEW MESSAGE:\n{query}"),
        ])
    except Exception as exc:
        print(f"⚠️ Query understanding failed ({exc.__class__.__name__}): {str(exc)[:160]}")
        return None
    if u is None:
        return None
    followup = u.followup if history else "none"
    courts = list(dict.fromkeys(u.courts_named_by_user))
    time_filter = u.time_filter
    dropped = []
    court_proof = _quoted_in_message(u.court_words, query)
    if court_proof and time_filter is not None and _same_words(u.court_words, u.time_words):
        court_proof = False   # the words that ask for years cannot also be the proof of a court
    if courts and not court_proof:
        dropped.append(f"court limit ({', '.join(courts)})")
        courts = []
    if time_filter is not None and not _quoted_in_message(u.time_words, query):
        dropped.append("year limit")
        time_filter = None
    return {
        "intent": u.intent,
        "followup": followup,
        "referenced_case": (u.referenced_case or "").strip() or None,
        "message_language": u.message_language,
        "requested_language": u.explicit_language_request,
        "search_query": " ".join((u.search_query or "").split()),
        "alternatives": [" ".join(q.split()) for q in u.alternative_queries if q.strip()][:2],
        "corrections": [c.strip() for c in u.indian_provision_notes if c.strip()][:4],
        "doc_types": [_COURT_DOC_TYPES[c] for c in courts],
        "years": _years_from_filter(time_filter),
        "dropped_limits": dropped,
        "multi_part": u.multi_part,
        "judge_args": {
            "request": u.judge_request if u.judge_request != "none" else "describe",
            "name": (u.judge_name or "").strip() or None,
            "courts": courts,
            "status": u.judge_status,
        } if u.intent == "judge_profile" else None,
        "interpretation": None,
        "clarification": None,
    }


# ------- Checking cited PPC / Cr.P.C. sections against the real codes -------
# The model sometimes attaches a section to the wrong code ("497 PPC" for bail,
# which is Cr.P.C. 497) or calls a Pakistani section Indian. Both codes are in
# the collection, so their own section titles settle what a number means; the
# model only decides which reading fits the user's question.

_CODE_TITLES_FILE = os.path.join(os.path.dirname(__file__), "..", "assets", "core_code_sections.json")
_code_titles: Optional[dict] = None
_CITED_RE = re.compile(
    r"\bSections?\s+(\d{1,3})(?:\s*-?\s*((?-i:[A-Z]){1,2})\b)?(?:\s*\(\w+\))*\s*,?\s*(?:of\s+the\s+)?"
    r"(Cr\.?\s*P\.?\s*C\.?|CrPC|Code of Criminal Procedure|P\.?\s*P\.?\s*C\.?|Pakistan Penal Code)?", re.I)


def _titles() -> dict:
    global _code_titles
    if _code_titles is None:
        try:
            with open(_CODE_TITLES_FILE, encoding="utf-8") as fh:
                _code_titles = json.load(fh)
        except (OSError, ValueError):
            _code_titles = {}
    return _code_titles


def _code_of(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    return "Cr.P.C." if re.match(r"(?i)c", name.strip()) else "PPC"


class _ProvisionReading(BaseModel):
    number: str = Field(description="The section number exactly as listed.")
    subject_of_question: str = Field(description="In a few words, what the user's question is about (e.g. 'bail', 'quashing an FIR', 'theft').")
    why: str = Field(description="One sentence comparing each of the two titles with that subject.")
    crpc_title_describes_subject: bool = Field(
        description="True only if the Cr.P.C. title given for this number is about that subject. False if it is about "
                    "something else, or reads Omitted / Repealed / no such section.")
    ppc_title_describes_subject: bool = Field(
        description="True only if the PPC title given for this number is about that subject. False if it is about "
                    "something else, or reads Omitted / Repealed / no such section.")


class _ProvisionCheck(BaseModel):
    readings: List[_ProvisionReading]


PROVISION_CHECK_SYSTEM = (
    "You check section references for a Pakistani legal research assistant. For each section number the question "
    "involves, you are given its real title in Pakistan's Code of Criminal Procedure, 1898 and in the Pakistan Penal "
    "Code, 1860. For each title, say whether it is about the subject of the user's question. Judge the title alone "
    "against the subject; ignore which code the question or the draft search names, since that may be the user's "
    "mistake. A section with that number merely existing is not enough — its title and opening words must be about "
    "the subject. Read the opening words: they show what the section actually does."
)


def check_cited_provisions(query: str, u: dict, trace: List[str]) -> dict:
    """Correct the code attached to PPC / Cr.P.C. sections in the search query, and drop
    'Indian provision' notes about sections that are Pakistani law on the user's subject."""
    titles = _titles()
    if not titles or u.get("intent") not in ("case_law", "statutory_law"):
        return u
    cited = {}
    for text in [u.get("search_query") or "", *(u.get("corrections") or [])]:
        for m in _CITED_RE.finditer(text):
            label = m.group(1) + (f"-{m.group(2).upper()}" if m.group(2) else "")
            cited.setdefault(label, _code_of(m.group(3)))
    cited = {l: c for l, c in cited.items()
             if l in titles.get("Cr.P.C.", {}).get("sections", {}) or l in titles.get("PPC", {}).get("sections", {})}
    if not cited:
        return u
    def _describe(code: str, label: str) -> str:
        info = titles.get(code, {})
        title = info.get("sections", {}).get(label)
        if not title:
            return "no such section"
        opening = info.get("openings", {}).get(label, "")
        return f'"{title}"' + (f' — begins: "{opening}…"' if opening and title.lower() not in ("omitted", "repealed") else "")
    lines = [f"Section {label}:\n  Cr.P.C.: {_describe('Cr.P.C.', label)}\n  PPC: {_describe('PPC', label)}" for label in cited]
    try:
        check: _ProvisionCheck = llm_service.get_understand_llm().with_structured_output(
            _ProvisionCheck, method="json_schema", strict=True,
        ).invoke([SystemMessage(content=PROVISION_CHECK_SYSTEM),
                  HumanMessage(content=f"QUESTION: {query}\nDRAFT SEARCH: {u.get('search_query', '')}\n\n" + "\n".join(lines))])
    except Exception as exc:
        trace.append(f"⚠️ Section check unavailable ({exc.__class__.__name__})")
        return u
    meant = {}
    for r in (check.readings if check else []):
        if r.crpc_title_describes_subject and not r.ppc_title_describes_subject:
            meant[r.number.strip()] = "Cr.P.C."
        elif r.ppc_title_describes_subject and not r.crpc_title_describes_subject:
            meant[r.number.strip()] = "PPC"
        elif r.crpc_title_describes_subject and r.ppc_title_describes_subject:
            meant[r.number.strip()] = cited.get(r.number.strip())   # both fit: keep what the user wrote
        else:
            meant[r.number.strip()] = "neither"
    search, notes = u.get("search_query") or "", list(u.get("corrections") or [])
    for label, written in cited.items():
        code = meant.get(label)
        if code not in ("Cr.P.C.", "PPC"):
            continue
        if written and written != code:
            new_search = _CITED_RE.sub(lambda m: (m.group(0).replace(m.group(3), code)
                                                  if m.group(3) and (m.group(1) + (f"-{m.group(2).upper()}" if m.group(2) else "")) == label
                                                  else m.group(0)), search)
            if new_search != search:
                trace.append(f"🔧 Section {label} is {code} on this subject (the draft said {written}) — search corrected")
                search = new_search
        def _calls_indian(note: str) -> bool:
            first = _CITED_RE.search(note)
            if not first:
                return False
            subject = first.group(1) + (f"-{first.group(2).upper()}" if first.group(2) else "")
            return subject == label and bool(re.search(r"(?i)\bindian\b", note[first.end():first.end() + 60]))
        kept = [n for n in notes if not _calls_indian(n)]
        if len(kept) < len(notes):
            trace.append(f"🔧 Section {label} {code} is Pakistani law on this subject — 'Indian provision' note dropped")
            notes = kept
    return {**u, "search_query": search, "corrections": notes}


# -------Node: understand_query---------

# How the message is handled, in plain words for the trace.
_ROUTE_LABELS = {
    "none": "follow-up or new question → new search using the conversation's context",
    "from_conversation": "follow-up → answered from the conversation, no search",
    "translate_previous": "follow-up → previous answer in another language",
    "cited_case": "follow-up → one case cited earlier",
}


def understand_query(state: AgentState) -> dict:
    query = state["original_query"]
    history = state.get("conversation_history", []) or []
    trace: List[str] = list(state.get("agent_trace", []))
    ui_filters = state.get("filters") or {}

    # Start searching the message as written while the model interprets it. For
    # a clear English first question the model keeps the query verbatim and the
    # search is reused; otherwise it is simply discarded.
    # (Not for one- or two-word messages: those are greetings far more often than
    # legal questions, and each speculative search is a paid embedding + rerank call.)
    if (not history and not ui_filters.get("court") and not ui_filters.get("year")
            and urdu_ratio(query) == 0 and len(query.split()) >= 3):
        prefetch_case_search(query)

    u = llm_understand(query, history)
    if u is None:
        trace.append("⚠️ Query understanding unavailable — searching the message as written")
        u = {"intent": "case_law", "followup": "none", "referenced_case": None,
             "message_language": "ur" if urdu_ratio(query) >= 0.3 else "en", "requested_language": None,
             "search_query": query, "alternatives": [], "corrections": [],
             "doc_types": [], "years": None, "multi_part": False, "judge_args": None,
             "interpretation": None, "clarification": None}

    u = check_cited_provisions(query, u, trace)
    lang = choose_answer_language(state.get("language_preference"), u["message_language"], u["requested_language"])
    trace.append(
        f"🧭 Understood: intent={u['intent']}, route={_ROUTE_LABELS.get(u['followup'], u['followup']) if history else 'new question'}, "
        f"written in {LANGUAGE_NAMES.get(u['message_language'], u['message_language'])} → answer in {LANGUAGE_NAMES.get(lang, lang)}"
    )
    base = {
        "answer_language": lang,
        "retry_count": 0,
        "corrections": [],
        "search_years": None,
        "search_doc_types": None,
        "multi_part": False,
        "restate_previous": False,
        "targeted_case": False,
        "judge_args": None,
        "search_failed": False,
        "interpretation": None,
        "clarification": None,
        "agent_trace": trace,
    }

    def history_only(restate: bool, note: str):
        trace.append(note)
        return {**base, "messages": [HumanMessage(content=query)], "search_query": query,
                "english_query": query, "query_intent": "conversational_followup",
                "restate_previous": restate, "query_variants": [query], "results_sufficient": True}

    if history and u["followup"] == "translate_previous":
        return history_only(True, f"🗣️ Restating the previous answer in {LANGUAGE_NAMES.get(lang, lang)} (no search)")
    if history and u["followup"] == "from_conversation":
        return history_only(False, "💬 Answering from the conversation (no new search)")

    if u["intent"] in ("conversational", "out_of_scope"):
        return {**base, "messages": [HumanMessage(content=query)], "search_query": "",
                "english_query": query, "query_variants": [query], "results_sufficient": False,
                "query_intent": "greeting" if u["intent"] == "conversational" else "out_of_scope"}

    if u.get("clarification") and u["followup"] == "none":
        # A cited provision does not exist as written and could not be resolved:
        # ask, rather than search for something that is not there.
        trace.append("❓ Reference unclear — asking the user to confirm instead of guessing")
        return {**base, "messages": [HumanMessage(content=query)], "search_query": "", "english_query": query,
                "query_variants": [query], "results_sufficient": False, "query_intent": "clarify",
                "clarification": u["clarification"]}

    if history and u["followup"] == "cited_case" and u["referenced_case"]:
        ref = u["referenced_case"]
        trace.append(f"🎯 Follow-up about a cited case → targeted search for '{ref[:80]}'")
        return {**base, "messages": [HumanMessage(content=ref)], "search_query": ref, "english_query": ref,
                "query_intent": "case_law", "query_variants": [ref], "results_sufficient": False,
                "targeted_case": True}

    search_query = u["search_query"] or query
    if search_query != query:
        # Provisions named in an Indian→Pakistani mapping note count as mentioned.
        # … and so do provisions the model resolved from shorthand (see interpretation_note).
        problem = validate_rewrite(search_query, " ".join([query, *u["corrections"], u.get("interpretation") or "", search_query if u.get("interpretation") else ""]), history)
        if problem and u["message_language"] == "en":
            trace.append(f"⚠️ Search query rejected ({problem}) — searching the message as written")
            search_query = query
        elif problem:
            trace.append(f"⚠️ Search query flagged ({problem}) — kept, since the message is not in English")
    if search_query != query:
        icon = "🌐 Translated for search" if u["message_language"] != "en" else "🔎 Search query"
        trace.append(f"{icon} → '{search_query[:90]}'")
    if u["corrections"]:
        trace.append("🇵🇰 Indian provision(s) mapped to Pakistani law")
    if u.get("dropped_limits"):
        trace.append(f"↩️ Ignored {' and '.join(u['dropped_limits'])}: not asked for in this message — searching everything")

    ui_year = str(ui_filters.get("year") or "").strip()
    search_years = [ui_year] if ui_year.isdigit() else (u["years"] if u["intent"] != "judge_profile" else None)
    if search_years:
        span = search_years[0] if len(search_years) == 1 else f"{search_years[0]}–{search_years[-1]}"
        trace.append(f"📅 Year filter: decisions from {span}")
    doc_types = None
    if u["doc_types"] and u["intent"] != "judge_profile":
        doc_types = u["doc_types"] + ["federal_law", "punjab_law", "court_rules"]
        trace.append(f"🏛️ Courts limited to: {', '.join(u['doc_types'])}")

    return {
        **base,
        "messages": [HumanMessage(content=search_query)],
        "search_query": search_query,
        "english_query": search_query,
        "query_intent": u["intent"],
        "query_variants": [search_query] + [q for q in u["alternatives"] if q != search_query],
        "corrections": u["corrections"],
        "search_years": search_years,
        "search_doc_types": doc_types,
        "multi_part": u["multi_part"],
        "judge_args": u.get("judge_args"),
        "interpretation": u.get("interpretation"),
        "results_sufficient": False,
    }


# --------Node: dispatch_search---------

def dispatch_search(state: AgentState) -> dict:
    query = state.get("search_query") or state["original_query"]
    intent = state.get("query_intent", "case_law")
    filters = state.get("filters") or {}
    update: dict = {}

    if intent == "judge_profile":
        args = {"query": query, **{k: v for k, v in (state.get("judge_args") or {}).items() if v}}
        tool_calls = [{"name": "search_judge_profiles", "args": args,
                       "id": "deterministic_dispatch_0", "type": "tool_call"}]
        trace_msg = f"⚡ Dispatch → search_judge_profiles ({args.get('request', 'describe')})"
    else:
        # A court chosen in the UI narrows the same search (years and breadth still apply).
        court_filter = str(filters.get("court", "")).strip()
        court_types = _map_court_to_case_doc_types(court_filter) if court_filter else None
        if court_types:
            update["search_doc_types"] = court_types
            state = {**state, "search_doc_types": court_types}
        # Statute questions and multi-part questions get the wider result set.
        name = "retrieve_with_full_pipeline" if (intent == "statutory_law" or state.get("multi_part")) else "search_case_law"
        tool_calls = [{"name": name, "args": _search_args(state, query),
                       "id": "deterministic_dispatch_0", "type": "tool_call"}]
        trace_msg = f"⚡ Dispatch → {name}"
        if court_types:
            trace_msg += f" | court chosen in the UI: {court_filter}"
        elif court_filter:
            trace_msg += f" | UI court '{court_filter}' not recognised — searching all courts"
        years = state.get("search_years")
        if years:
            trace_msg += f" | years {years[0]}" + (f"–{years[-1]}" if len(years) > 1 else "")

    return {
        **update,
        "messages": [AIMessage(content="", tool_calls=tool_calls)],
        "agent_trace": state.get("agent_trace", []) + [trace_msg],
    }


def _search_args(state: AgentState, query: str) -> dict:
    """Tool arguments carrying the understanding step's years / courts / breadth."""
    args = {"query": query}
    if state.get("search_years"):
        args["years"] = state["search_years"]
    if state.get("search_doc_types"):
        args["doc_types"] = state["search_doc_types"]
    if state.get("multi_part") or state.get("query_intent") == "statutory_law":
        args["broad"] = True
    return args


# --------Node: evaluate_results---------

# Retry budget for weak/empty retrieval. The counter is incremented ONLY in
# refine_and_retry; evaluate_results / verify_grounding just read it. (Both used
# to increment, so one weak search could cost up to 4 search rounds.)
MAX_RETRIES = int(os.getenv("AGENT_MAX_RETRIES", "1"))


def evaluate_results(state: AgentState) -> dict:
    """Decide whether the latest search batch is good enough to continue."""
    trace = list(state.get("agent_trace", []))
    retry_count = state.get("retry_count", 0)
    outputs = latest_tool_outputs(state["messages"])
    combined = "\n\n".join(outputs)
    has_docs = "[Doc " in combined

    if not has_docs and any(o.startswith(SEARCH_UNAVAILABLE) for o in outputs):
        # The search service failed — retrying or calling it "no results" would be wrong.
        return {"results_sufficient": False, "search_failed": True,
                "agent_trace": trace + ["🛑 Search service unreachable — telling the user instead of guessing"]}
    if state.get("query_intent") == "judge_profile" and not has_docs:
        # Judge lookup is exact: a rephrased case-law search cannot find a judge.
        # The answer step reports honestly that the profile is not in the collection.
        return {"results_sufficient": True,
                "agent_trace": trace + ["ℹ️ No matching judge profile — answering honestly without a retry"]}

    if has_docs:
        scores = [float(x) for x in re.findall(r"score=([\d\.]+)", combined)]
        best_score = max(scores) if scores else 0.0
        if state.get("query_intent") == "judge_profile" and best_score >= 8.0:
            return {"results_sufficient": True,
                    "agent_trace": trace + [f"✅ Excellent judge profile match (score={best_score:.1f})"]}
        if best_score >= 0.35:
            return {"results_sufficient": True,
                    "agent_trace": trace + [f"✅ Sufficient results (best_score={best_score:.2f})"]}
        weak = f"weak results (best_score={best_score:.2f})"
    else:
        weak = "no matching documents"

    if retry_count < MAX_RETRIES:
        return {"results_sufficient": False,
                "agent_trace": trace + [f"🔄 {weak.capitalize()} — retrying ({retry_count + 1}/{MAX_RETRIES})"]}
    if has_docs:
        # Out of retries but we do have documents: let the relevance gate judge them.
        return {"results_sufficient": True,
                "agent_trace": trace + [f"🛑 Retries used up with {weak} — continuing with what was found"]}
    return {"results_sufficient": False,
            "agent_trace": trace + [f"🛑 Retries used up with {weak}"]}


def refine_and_retry(state: AgentState) -> dict:
    """Weak first search: try the alternative phrasings the understanding step
    proposed (different legal terms / the governing provision)."""
    retry = state.get("retry_count", 0) + 1
    query = state.get("search_query") or state.get("original_query", "")
    alternatives = [q for q in (state.get("query_variants") or [])[1:] if q and q != query] or [query]
    tool_calls = [
        {"name": "retrieve_with_full_pipeline", "args": {**_search_args(state, q), "broad": True},
         "id": f"retry_{retry}_{i}", "type": "tool_call"}
        for i, q in enumerate(alternatives[:2])
    ]
    trace_msg = f"🔄 Retry {retry}/{MAX_RETRIES} | {len(tool_calls)} alternative phrasing(s): " + " | ".join(q[:60] for q in alternatives[:2])
    return {
        "messages": [AIMessage(content="", tool_calls=tool_calls)],
        "retry_count": retry,
        "agent_trace": state.get("agent_trace", []) + [trace_msg],
    }


SYNTHESIZE_SYSTEM = """You are **Justice AI**, a Pakistani legal research assistant for practicing lawyers. Answer using ONLY the retrieved documents below. Extract real facts, names, dates, quotes — never fabricate.

## RULES
1. **Only retrieved docs**: No outside knowledge. If data is missing, say so.
2. **Only cases you actually have**: Discuss only cases that are among the retrieved documents. A case merely cited inside another judgment may be mentioned in passing — never presented as if you had read it.
3. **No overgeneralization**: State the specific legal context each provision applies to. If docs cover only one aspect of a broad topic, say so.
4. **Correct court attribution**: Keep each case tied to its actual court (Supreme Court, Islamabad High Court, Lahore High Court, or the named district court). A district-court judgment is a trial or first-appeal decision: present it as how that court decided, never as binding precedent. If a judgment quotes another court, do not mislabel the source court.
5. **Real details only**: Extract judge names, parties, advocates, verdict from the text. If missing, write \"Not available in retrieved text\".
6. **No hallucinated data**: Never invent dates, names, section numbers, or facts not in the documents.
   **ABSOLUTELY NEVER cite Indian laws.** This is a Pakistani legal system. Common Indian sections that MUST NOT appear:
   - Section 482 CrPC → PAKISTANI equivalent: **Section 561-A Cr.P.C.**
   - Section 498-A IPC → Does NOT exist in Pakistan. Domestic violence is covered by **Punjab Protection of Women Against Violence Act 2016** or **Domestic Violence (Prevention and Protection) Act 2012**.
   - IPC sections → Pakistan uses **PPC (Pakistan Penal Code)**, not IPC.
   - CrPC 1973 (Indian) → Pakistan uses **Cr.P.C. 1898** (Code of Criminal Procedure 1898).
   If a user's question mentions an Indian section, correct them and provide the Pakistani equivalent.
7. **Court-coverage honesty**: If user asks about a specific court but retrieved docs are from other courts, state that clearly.
8. **\"NO DATA AVAILABLE\"**: If tool output says this, tell the user honestly.
9. **IRRELEVANT RESULTS**: If the retrieved documents do NOT explicitly address the specific Act, law or topic asked about, do not analyse them as if they did. Say plainly that the specific topic is not in the database and, if useful, note in one sentence what the nearest documents actually cover.

---
## FORMAT A — JUDGE PROFILE (intent = judge_profile)

**JUDGE PROFILE RESPONSE.** Display judge information ONLY with available data. Do NOT show "Not available" fields.

**Structure:**
### ⚖️ *Judge Name*
*Court Name* | *Designation*

*Brief professional summary from the biography (2-3 sentences)*

**Profile Information:**
- **Status:** Active / Retired / Former
- **Chief Justice:** Yes/No (only if applicable)
- **Appointed to the bench:** Date if available — the date the person became a judge of the court; never present it as the date of becoming Chief Justice
- **Court:** Full court name

**Visual:** If the profile has a photo, include it exactly as given, as a Markdown image: `![Judge Name](image_url)`. Never write HTML tags.

**Summary Sections (ONLY if data available in documents):**
- **🎓 Education:** Degrees and institutions
- **⚖️ Career Highlights:** Key positions and milestones
- **📋 Notable Cases:** Important judgments if mentioned
- **🏛️ Administrative Roles:** Any administrative positions

**CRITICAL RULES FOR JUDGE PROFILES:**
1. **NO "NOT AVAILABLE" PHRASES** - Simply omit fields if data is missing
2. **NO TABLE FORMAT** - Use clean prose and bullet points
3. **ONLY show fields that have actual data** - If education not in documents, don't include an education section
4. **Be concise** - 2-3 sentences of summary, then bullet points for details
5. **If biography is empty**, just show the profile info and image
6. **No case cards** - This is a judge profile, not case analysis
7. **Several judges** (a list request, or more than one judge with that name): give a clean bulleted list — name, court, designation, sitting/former — instead of one profile. If the tool output says only part of the roster is shown, say so.

---

## FORMAT B — LEGAL ANSWERS (all other intents)

Write the way a top-tier legal AI assistant writes: clear, well-organised, natural prose — not a form. No fixed templates, no case "cards", no empty boilerplate sections. Use Markdown lightly: short paragraphs, **bold** for the key conclusion, bullet points for genuine lists, a `###` heading only when it helps a longer answer, a small table only when comparing several provisions.

The answer has exactly three parts — opening, body, ending — and nothing after the ending. (gpt-style recap blocks such as "Key points", "Key legal principles", "Summary", "Conclusion" are NOT part of this structure: the opening already states the conclusion and the body already states the principles, so a recap only repeats them.)
1. **Answer first.** Open with 2–4 sentences that directly answer what was asked — yes/no and the legal position where applicable — naming the governing provision inline (e.g. Section 497 Cr.P.C.).
2. **Explain the law.** Walk through the relevant principles in a logical order, citing authority inline as you go: *Case Name* (Citation, Court, Year). For each case you rely on, give the material facts in a clause or sentence, what the court held, and why it matters here — woven into the narrative, 1–3 sentences per case. Quote the court sparingly, only where a short phrase (≤20 words) is decisive.
3. **Provisions.** Name sections/articles inline where they arise. If three or more provisions matter, add a compact bullet list or a 2–3 column table.
4. **Close once.** If the question is practical, end with 2–4 short bullets on what to do, argue or file next, consistent with the authorities above. Otherwise end with a single bottom-line sentence. That ending IS the conclusion — do not also add a "Summary", "Conclusion", "Key points" or "In conclusion" block; the answer already opened with the conclusion.

Tone: professional and direct; confident where the law is clear, candid where it is not. Length proportional to the question — usually 250–500 words. Never pad, never repeat yourself, never add a section with nothing in it.

Honesty: if the documents only partly answer, say so in one sentence (what IS covered and what ISN'T). Keep each case tied to its real court. For details genuinely missing from the text write "not stated in the judgment" rather than inventing them.

Holding vs. facts: attribute to a case only what the court itself HELD or reasoned. Facts of that case, the parties' arguments, and orders of lower courts recited in the judgment are not holdings — describe them as what happened in that case ("the Family Court had awarded iddat maintenance"), never as a general rule ("maintenance is limited to iddat"). Never build a general principle out of one case's facts.

Talk like a lawyer, not a search engine: refer to judgments by case name or as "the judgment" / "the court", never as "documents", "retrieved documents" or "the first document".

---

## GLOBAL
- *Italic* case names, with the citation in parentheses right after the name on first mention.
- Exactly one ending (practical bullets OR one bottom-line sentence). Never a "Summary"/"Conclusion"/"In conclusion" section that restates the body — the reader has just read it.
- No Sources/References section (shown separately). No PDF links.
"""





_INDIAN_LAW_REPLACEMENTS = [
    (re.compile(r'Section\s+482\s+Cr\.?P\.?C\.?', re.IGNORECASE), 'Section 561-A Cr.P.C.'),
    (re.compile(r'S\.\s*482\s+Cr\.?P\.?C\.?', re.IGNORECASE), 'S. 561-A Cr.P.C.'),
    (re.compile(r'\bIPC\b'), 'PPC'),
    (re.compile(r'\bIndian Penal Code\b', re.IGNORECASE), 'Pakistan Penal Code'),
    (re.compile(r'Cr\.?P\.?C\.?\s*,?\s*1973', re.IGNORECASE), 'Cr.P.C. 1898'),
    (re.compile(r'Code of Criminal Procedure,?\s*1973', re.IGNORECASE), 'Code of Criminal Procedure, 1898'),
    (re.compile(r'Indian Evidence Act', re.IGNORECASE), 'Qanun-e-Shahadat Order, 1984'),
]

_SECTION_REF_RE = re.compile(r'\b(Section|S\.)\s*([0-9]{1,4}[A-Za-z\-]*)\b', re.IGNORECASE)
_ARTICLE_REF_RE = re.compile(r'\bArticle\s*([0-9]{1,3}[A-Za-z\-]*)\b', re.IGNORECASE)
# Same as _SECTION_REF_RE but also swallows a trailing statute code ("Section 420 PPC")
# so the *(unverified)* flag lands after the whole reference, not mid-phrase.
_SECTION_FLAG_RE = re.compile(
    r'\b(Section|S\.)\s*([0-9]{1,4}[A-Za-z\-]*(?:\([A-Za-z0-9]{1,3}\))*)'
    r'((?:\s*(?:,|/|-)?\s*(?:PPC|P\.P\.C\.?|Cr\.?\s*P\.?\s*C\.?|CrPC|CPC|C\.P\.C\.?|QSO))?)',
    re.IGNORECASE,
)


def sanitize_indian_law_references(text: str) -> str:
    for pattern, replacement in _INDIAN_LAW_REPLACEMENTS:
        text = pattern.sub(replacement, text)
    return text


_UNICODE_SPACES = dict.fromkeys(map(ord, "     "), " ")
_PROVISION_NUM_RE = re.compile(r'\b\d{1,4}(?:\s*[-–]?\s*[A-Za-z]{1,2})?\b')
_STATUTE_CODES = r"ppc|p\.p\.c|cr\.?\s*p\.?\s*c|crpc|cpc|c\.p\.c|qso|of\s+the\s+(?:code|act|ordinance|order|constitution|rules)"
UNVERIFIED_MARK = "*(unverified)*"


def _canon_token(tok: str) -> str:
    return re.sub(r"[\s\-–]", "", tok).lower()


def enforce_grounded_citations(answer: str, retrieved_context: str, original_query: str = "",
                               extra_allowed: str = "") -> str:
    """Flag provision references in the answer that are NOT supported by the
    retrieved context — without mutilating the answer.

    Old behaviour replaced "Section 302 PPC" with "the cited provision", which
    (a) hid WHICH section was claimed and (b) fired on perfectly grounded
    answers whenever the query said "302 PPC" without the word "Section" or the
    judgment wrote "S. 302"/"302, PPC". Now we:
      • normalise unicode spaces (gpt-oss emits U+202F),
      • allow any provision number the user asked about, in any phrasing,
        plus corrected Indian→Pakistani provisions (extra_allowed),
      • accept the context forms lawyers actually use (S. 302, 302 PPC,
        u/s 302, 561-A / 561A),
      • and when a reference is still unsupported, keep it and append
        *(unverified)* so the lawyer sees exactly what to double-check.
    """
    answer = answer.translate(_UNICODE_SPACES)
    ctx = retrieved_context.translate(_UNICODE_SPACES).lower()
    allowed = {_canon_token(t) for t in _PROVISION_NUM_RE.findall(f"{original_query or ''} {extra_allowed or ''}")}

    def _variants(tok: str):
        base = re.sub(r"\(.*$", "", tok).replace("–", "-")  # drop sub-clauses: 2(d) → 2
        return {base.lower(), base.replace("-", " ").lower(), base.replace("-", "").lower()}

    def section_in_context(tok: str) -> bool:
        for v in _variants(tok):
            v = re.escape(v)
            if re.search(rf'(?:sections?|sec\.?|ss?\.|u/s|under)\s*{v}\b', ctx):
                return True
            if re.search(rf'\b{v}\s*(?:,|\(|/|-)?\s*(?:{_STATUTE_CODES})', ctx):
                return True
            # Statute text numbers its own sections at line start: "2. Interpretation…"
            if re.search(rf'(?m)^\s*{v}\.\s', ctx):
                return True
        return False

    def article_in_context(tok: str) -> bool:
        for v in _variants(tok):
            v = re.escape(v)
            if re.search(rf'(?:articles?|art\.?)\s*{v}\b', ctx):
                return True
        return False

    def section_repl(match):
        tok = match.group(2)
        base = re.sub(r"\(.*$", "", tok)
        if _canon_token(base) in allowed or section_in_context(tok):
            return match.group(0)
        return f"{match.group(0)} {UNVERIFIED_MARK}"

    def article_repl(match):
        tok = match.group(1)
        if _canon_token(tok) in allowed or article_in_context(tok):
            return match.group(0)
        return f"{match.group(0)} {UNVERIFIED_MARK}"

    answer = _SECTION_FLAG_RE.sub(section_repl, answer)
    answer = _ARTICLE_REF_RE.sub(article_repl, answer)
    return answer


def build_conservative_fallback(query: str, retrieved_context: str) -> str:
    doc_lines = [ln.strip() for ln in retrieved_context.splitlines() if ln.strip().startswith("[Doc ")]
    top_docs = doc_lines[:3]

    bullets = []
    for ln in top_docs:
        parts = [p.strip() for p in ln.split("|")]
        title_part = parts[0]
        title = title_part.split("]", 1)[-1].strip() if "]" in title_part else title_part
        court = parts[2] if len(parts) > 2 else ""
        year = parts[3] if len(parts) > 3 else ""
        bullets.append(f"- {title} ({court}, {year})")

    if not bullets:
        return (
            "### Nothing on Point Found\n"
            "I searched the Supreme Court, High Court and statute collections and found nothing that matches "
            "this question closely enough to answer from. Rather than guess, I am not giving an answer.\n\n"
            "### How to Get a Better Answer\n"
            "1. Name the statute and section, or the exact legal issue involved.\n"
            "2. Add the key facts and the stage of the matter (for example: before filing, trial, appeal).\n"
            "3. Mention a court or a range of years if you are looking for particular judgments."
        )

    return (
        "### Grounded Response\n"
        "The retrieved evidence does not support a fully confident final legal conclusion for every part of your query. "
        "To avoid hallucinations, I am limiting the response to what is clearly grounded in the retrieved Supreme Court, High Court and statute material.\n\n"
        "### What Was Retrieved\n"
        + "\n".join(bullets)
        + "\n\n"
        "### What Can Be Safely Said\n"
        "- These judgments relate to the legal area of your question, but they do not contain enough on the "
        "specific point to support a definitive answer.\n\n"
        "### How to Get a Better Answer\n"
        "1. Name the statute and section, or the exact legal issue involved.\n"
        "2. Add the key facts and the stage of the matter (for example: before filing, trial, appeal).\n"
        "3. Mention a court or a range of years if you are looking for particular judgments."
    )


def has_grounding_risk(answer: str, retrieved_context: str) -> bool:
    """Detect whether the synthesised answer is likely hallucinated.

    The previous implementation was too aggressive:
      - LOW RELEVANCE WARNING alone killed the answer instantly.
      - A single replaced citation ("the cited provision") killed the answer.
    Now we use a *scoring* approach: multiple weak signals must co-occur
    before we flag grounding risk.
    """
    risk_signals = 0

    if "LOW RELEVANCE WARNING" in retrieved_context:
        risk_signals += 1  # weak signal, not fatal on its own

    replaced_refs = answer.count(UNVERIFIED_MARK)
    if replaced_refs >= 3:
        risk_signals += 2  # many hallucinated refs = strong signal
    elif replaced_refs >= 1:
        risk_signals += 1  # a few = weak signal

    answer_terms = set(re.findall(r'[a-z]{4,}', answer.lower()))
    context_terms = set(re.findall(r'[a-z]{4,}', retrieved_context.lower()))
    overlap = len(answer_terms & context_terms) / max(1, len(answer_terms))
    # Only meaningful for English text: an Urdu answer has few Latin words (just
    # case names and citations), so a low count says nothing about grounding.
    if len(answer_terms) >= 15 and overlap < 0.08:
        risk_signals += 2  # very low overlap = strong signal

    # Require at least 2 cumulative risk points to trigger fallback
    return risk_signals >= 2


# --------Node: verify_grounding----------

def verify_grounding(state: AgentState) -> dict:
    """Check the latest search batch mentions the provisions the user asked about."""
    trace = list(state.get("agent_trace", []))
    combined = "\n\n".join(latest_tool_outputs(state["messages"]))

    if state.get("query_intent") == "judge_profile":
        # The judge tool handles court-specific retrieval itself.
        return {"results_sufficient": True,
                "agent_trace": trace + ["🧪 Grounding: judge_profile intent — trusting judge tool."]}

    # Use the search query: it carries Indian→Pakistani corrections (482 → 561-A),
    # so we check for markers that can actually exist in the Pakistani corpus.
    requested_markers = extract_provision_markers(state.get("search_query") or state.get("original_query", ""))
    if requested_markers and not any(m in combined.lower() for m in requested_markers):
        if state.get("retry_count", 0) < MAX_RETRIES:
            return {"results_sufficient": False,
                    "agent_trace": trace + ["🧪 Grounding: requested provision not in results — retrying once"]}
        # Retries used up: don't loop. The relevance gate decides whether what
        # we have actually answers the question (or returns an honest no).
        return {"results_sufficient": True,
                "agent_trace": trace + ["🧪 Grounding: requested provision still missing — relevance gate will judge"]}

    return {"results_sufficient": True,
            "agent_trace": trace + ["🧪 Grounding verification passed: evidence is sufficient for synthesis."]}


# --------Node: assess_relevance (answerability gate)----------

ASSESS_SYSTEM = (
    "You are a strict reviewer for a Pakistani legal research assistant. You see a user's "
    "legal question and excerpts of documents a search engine returned. Decide whether each "
    "document GENUINELY addresses the question.\n\n"
    "RULES:\n"
    "1. A document is relevant ONLY if its excerpt explicitly discusses the legal issue asked about.\n"
    "2. Sharing a court, a year, a party name, or a passing mention of a keyword in a different "
    "context does NOT make a document relevant. Never mark a document 'potentially' relevant.\n"
    "3. For every relevant document you MUST copy a short verbatim quote (5–12 words) from its "
    "EXCERPT TEXT that shows it addresses the question. The first line of each document (title, "
    "court, year, citation) is metadata, NOT evidence — never quote it. If you cannot quote such "
    "a passage, the document is not relevant. Never infer that a document 'likely' covers a topic.\n"
    "4. Verdicts: \"yes\" = the documents address the SPECIFIC subject asked. \"partial\" = they "
    "address the general legal area but not the specific subject (e.g. privacy rights in general, "
    "but nothing about drones). \"no\" = nothing explicitly addresses the question (empty list).\n"
    "5. If a SEARCH FOCUS is given (e.g. a specific case the user wants explained), judge relevance "
    "against that focus.\n\n"
    "Return the verdict, the relevant documents (each with its number and the verbatim quote "
    "from that excerpt), and the reason in one short sentence."
)


class _RelevantDoc(BaseModel):
    doc: int = Field(description="The document number as printed in [Doc N].")
    evidence: str = Field(description="Verbatim quote (5-12 words) from that document's EXCERPT TEXT.")


class RelevanceReview(BaseModel):
    verdict: Literal["yes", "partial", "no"]
    relevant_docs: List[_RelevantDoc]
    reason: str


# Words that say WHERE/WHAT KIND (court, ruling…) rather than the legal subject.
_GENERIC_QUERY_WORDS = _EXCERPT_STOPWORDS | {
    "supreme", "high", "lahore", "islamabad", "ruling", "rulings", "decision", "decisions",
    "decided", "order", "orders", "petition", "client", "explain", "tell", "detail", "details",
    "regarding", "related", "relating", "matter", "matters", "issue", "issues", "question",
    "grounds", "available", "what", "which", "your", "mine",
}


def _topic_terms(text: str) -> set:
    toks = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)?", (text or "").lower())
    return {t for t in toks if (len(t) > 3 or any(ch.isdigit() for ch in t))
            and t not in _GENERIC_QUERY_WORDS and not re.fullmatch(r"(19|20)\d\d", t)}


def _evidence_on_topic(evidence: str, terms: set) -> bool:
    """The quoted evidence must touch the subject asked about. A real quote about
    something else (e.g. a judges'-transfer passage offered for a crypto question)
    proves the document exists, not that it is relevant. Prefix match tolerates
    inflections (harass/harassment, regulation/regulatory)."""
    if not terms:
        return True
    ev = (evidence or "").lower()
    return any(t in ev or (len(t) > 5 and t[:6] in ev) for t in terms)


def _topic_coverage(text: str, terms: set) -> float:
    """Share of the question's subject terms that appear in `text` (0–1).

    Used as the fallback for a confident 'yes': one generic word in common
    ("regulation" appearing in an unrelated judgment) is not enough — most of
    the subject terms must be there."""
    if not terms:
        return 1.0
    low = (text or "").lower()
    return sum(1 for t in terms if t in low or (len(t) > 5 and t[:6] in low)) / len(terms)


_HEDGE_WORDS = ("likely", "probably", "possibly", "potentially", "may ", "might", "appears to", "seems to", "presumably")


def _evidence_in_text(evidence: str, text: str, threshold: float = 0.7) -> bool:
    """Programmatic check that the reviewer's quoted evidence really appears in the doc."""
    words = [w for w in re.findall(r"[a-z0-9]+", (evidence or "").lower()) if len(w) > 2]
    if not words:
        return False
    body = text.lower()
    hits = sum(1 for w in words if w in body)
    return hits / len(words) >= threshold


# Top rerank score at/above which the LLM relevance review is skipped.
GATE_SKIP_SCORE = float(os.getenv("GATE_SKIP_SCORE", "0.75"))


def assess_relevance(state: AgentState) -> dict:
    """Cheap LLM check that the retrieved documents actually answer the question.

    Catches the failure mode where retrieval returns topically-adjacent documents
    (e.g. a judges'-transfer case for a 'cryptocurrency regulation' question) and
    synthesis then fabricates an attribution. Falls open (all docs) on any error.
    """
    intent = state.get("query_intent", "")
    trace = list(state.get("agent_trace", []))
    if intent in ("judge_profile", "conversational_followup"):
        return {"answerable": True, "relevant_doc_ids": None,
                "agent_trace": trace + [f"🧪 Relevance gate skipped ({intent})"]}

    combined = "\n\n".join(latest_tool_outputs(state["messages"]))

    # Strong reranker match → the documents demonstrably address the question;
    # skip the 2–4s LLM review. Every fabrication case seen in testing scored
    # ≤0.68 (crypto 0.50, drones 0.65, invented sections 0.53–0.68), while every
    # genuine strong match scored ≥0.75. Weak/borderline results still get reviewed.
    scores = [float(x) for x in re.findall(r"score=([\d\.]+)", combined)]
    best = max(scores) if scores else 0.0
    if best >= GATE_SKIP_SCORE:
        ids = None
        if state.get("targeted_case"):
            # Targeted follow-up ("explain the first case"): keep only the blocks whose
            # header names that case, so unrelated neighbours don't dilute the answer.
            _, blocks = split_doc_blocks(combined)
            title_terms = _topic_terms(state.get("search_query", ""))
            ids = [i for i, (_, body) in enumerate(blocks, 1)
                   if _topic_coverage(body.split("\n", 1)[0], title_terms) >= 0.5] or None
        return {"answerable": True, "relevant_doc_ids": ids, "assessment_verdict": "yes",
                "agent_trace": trace + [f"🧪 Relevance gate skipped — strong match (top score {best:.2f} ≥ {GATE_SKIP_SCORE})"
                                        + (f"; targeted follow-up → doc(s) {ids}" if ids else "")]}

    _, blocks = split_doc_blocks(combined)
    if not blocks:
        return {"answerable": True, "relevant_doc_ids": None, "agent_trace": trace}

    question = state.get("english_query") or state.get("original_query", "")
    focus = state.get("search_query", "")

    briefs, passages = [], []
    for i, (_, body) in enumerate(blocks, 1):
        header = _DOC_HDR_RE.sub(f"[Doc {i}]", body.split("\n", 1)[0], count=1)
        header = header.split("| score=")[0].strip()
        m = re.search(r"\[(?:PASSAGE|BIOGRAPHY)\]\n(.*)", body, re.S)
        passage = m.group(1) if m else body.split("\n", 1)[-1]
        # Ingested chunks start with their own "[CASE] title | court | year" header;
        # strip it so a reviewer can't pass off metadata as evidence.
        passage_text = re.sub(r"^\s*\[(?:CASE|LAW|JUDGE)\][^\n]*\n", "", passage)
        passages.append(passage_text)
        excerpt = focused_excerpt(passage_text, f"{question} {focus}")
        briefs.append(f"{header}\nEXCERPT TEXT: {excerpt.replace(chr(10), ' ')}")
    corrections = state.get("corrections") or []
    corr_note = ""
    if corrections:
        # The user cited Indian law; judge relevance against the Pakistani equivalent.
        corr_note = ("NOTE: the user cited Indian provisions. Treat the question as asking about the "
                     "Pakistani equivalents below — documents on those equivalents ARE relevant:\n"
                     + "\n".join(f"- {c}" for c in corrections) + "\n")
    user_msg = (
        f"QUESTION: {question}\n"
        + (f"SEARCH FOCUS: {focus}\n" if focus and focus != question else "")
        + corr_note
        + "\nDOCUMENTS:\n" + "\n\n".join(briefs)
    )
    try:
        review: RelevanceReview = llm_service.get_assess_llm().with_structured_output(
            RelevanceReview, method="json_schema", strict=True,
        ).invoke([SystemMessage(content=ASSESS_SYSTEM), HumanMessage(content=user_msg)])
        if review is None:
            raise ValueError("empty review")
        data = review.model_dump()
    except Exception as exc:
        return {"answerable": True, "relevant_doc_ids": None,
                "agent_trace": trace + [f"🧪 Relevance gate unavailable ({exc.__class__.__name__}) — using all docs"]}

    verdict = str(data.get("verdict", "yes")).lower().strip()
    reason = str(data.get("reason", ""))[:200]
    # A "yes" justified with "likely/probably/may cover…" is a guess, not a finding:
    # treat it as partial so the stricter quote-level topic check applies.
    if verdict == "yes" and any(h in reason.lower() for h in _HEDGE_WORDS):
        trace.append("🧪 Relevance gate: reviewer hedged ('likely/probably') — downgraded to partial")
        verdict = "partial"

    # Accept only documents whose quoted evidence (a) really is in the passage and
    # (b) is about the subject asked. A lenient reviewer can call a doc "likely
    # related"; it cannot fabricate a quote, nor make an off-topic quote on-topic.
    # Targeted follow-ups ("explain the first case") are exempt from (b): the
    # document was fetched by its title, so it is on-topic by construction.
    targeted = bool(state.get("targeted_case"))
    terms = set() if targeted else _topic_terms(question) | _topic_terms(focus)
    ids, unverified, off_topic = [], [], []
    for item in data.get("relevant_docs", []) or []:
        if isinstance(item, dict):
            num, evidence = item.get("doc"), str(item.get("evidence", ""))
        else:
            num, evidence = item, ""
        try:
            num = int(num)
        except (TypeError, ValueError):
            continue
        if not 1 <= num <= len(blocks):
            continue
        # Verify against the passage body only — quoting the title/court/year line doesn't count.
        if not _evidence_in_text(evidence, passages[num - 1]):
            unverified.append(num)
            continue
        # A confident "yes" only needs the document itself to contain the subject
        # (the quote may use a synonym: "civil servant" for "service"). A hedged
        # "partial" — where speculative attributions show up — needs the quote itself
        # to be on-topic.
        on_topic = _evidence_on_topic(evidence, terms) or (
            verdict == "yes" and _topic_coverage(passages[num - 1], terms) >= 0.6
        )
        if not on_topic:
            off_topic.append(num)
            continue
        ids.append(num)
    ids = sorted(set(ids))
    if unverified:
        trace.append(f"🧪 Relevance gate: dropped doc(s) {unverified} — quoted evidence not found in their text")
    if off_topic:
        trace.append(f"🧪 Relevance gate: dropped doc(s) {off_topic} — evidence doesn't touch the question's subject")

    if verdict == "no" or not ids:
        return {"answerable": False, "relevant_doc_ids": [], "assessment_reason": reason,
                "assessment_verdict": "no",
                "agent_trace": trace + [f"🚫 Relevance gate: retrieved documents do not address the question — {reason}"]}
    return {"answerable": True, "relevant_doc_ids": ids, "assessment_reason": reason,
            "assessment_verdict": verdict,
            "agent_trace": trace + [f"✅ Relevance gate: {verdict} — using doc(s) {ids}" + (f" ({reason})" if reason else "")]}


# --------Node: respond_not_covered----------

NOT_COVERED_LIST_MIN_SCORE = float(os.getenv("NOT_COVERED_LIST_MIN_SCORE", "0.6"))


def respond_not_covered(state: AgentState) -> dict:
    """Honest reply when the relevance gate finds nothing on point."""
    _, blocks = split_doc_blocks("\n\n".join(latest_tool_outputs(state["messages"])))
    # Name the nearest judgments only when they are reasonably close to the question;
    # weak matches (a shared number or word) only confuse.
    titles = []
    for _, body in blocks[:4]:
        header = body.split("\n", 1)[0]
        title = header.split("]", 1)[-1].split("|")[0].strip()
        m = re.search(r"score=([\d.]+)", header)
        if title and title not in titles and m and float(m.group(1)) >= NOT_COVERED_LIST_MIN_SCORE:
            titles.append(title)
    reason = state.get("assessment_reason", "")
    q = state.get("original_query", "")
    answer = (
        "### ⚖️ Not Covered in the Database\n\n"
        f"I searched the Supreme Court, High Court and statute collections, but none of the retrieved "
        f"documents actually address: **{q}**\n\n"
        + (f"_Reviewer note: {reason}_\n\n" if reason else "")
        + ("**Closest judgments found (related, but not on point):**\n" + "\n".join(f"- {t}" for t in titles) + "\n\n" if titles else "")
        + "Rather than guess, I won't attribute holdings to judgments that don't contain them. You could try:\n"
        "1. Rephrasing with the specific statute, section, or legal issue involved\n"
        "2. Naming a court or year range if you have one\n"
        "3. Asking about a related, more established doctrine"
    )
    answer = localize(answer, state.get("answer_language") or "en")
    return {
        "final_answer": answer,
        "sources_summary": "",
        "messages": [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + ["🛑 Honest no-answer returned (relevance gate)"],
    }


# --------Node: synthesize_answer----------

def synthesize_answer(state: AgentState) -> dict:
    llm = llm_service.get_llm()

    # Use only the latest tool-output batch to avoid oversized prompts.
    tool_outputs = latest_tool_outputs(state["messages"])

    # Keep the structured [Doc N of M] format the prompt expects, but budget it
    # per-document (see budget_context) and drop docs the relevance gate rejected.
    combined_raw = "\n\n".join(tool_outputs)
    preamble, blocks = split_doc_blocks(combined_raw)
    relevant = state.get("relevant_doc_ids")
    if relevant:
        blocks = [b for i, b in enumerate(blocks, 1) if i in relevant] or blocks
    blocks = budget_context(blocks, query=" ".join(filter(None, [state.get("search_query"), state.get("english_query")])))
    warn = "".join(line + "\n" for line in preamble.splitlines()
                   if "LOW RELEVANCE" in line or "YEAR FILTER" in line)
    if blocks:
        combined_context = rebuild_context(blocks, warn)
    else:
        combined_context = combined_raw[: int(os.getenv("CONTEXT_MAX_TOTAL_CHARS", "30000"))]

    doc_count = len(blocks)

    conv_context = format_conversation_history(state.get("conversation_history", []))
    conv_section = f"\nPrior conversation:\n{conv_context}" if conv_context else ""

    query_intent = state.get("query_intent", "mixed")
    corrections = state.get("corrections") or []
    corr_section = ""
    if corrections:
        corr_section = (
            "\nTERMINOLOGY CORRECTIONS — the user cited Indian provisions. Use ONLY the Pakistani "
            "equivalents below; do not cite the Indian sections as law:\n"
            + "\n".join(f"- {c}" for c in corrections) + "\n"
        )

    if query_intent == "conversational_followup":
        doc_section = ""
        prompt_instruction = "Answer the follow-up question naturally based strictly on the prior conversation."
    else:
        doc_section = f"--- RETRIEVED DOCUMENTS ({doc_count} total) ---\n{combined_context}\n\n"
        # The last thing the model reads carries the most weight, so the two rules
        # it most often broke (calling judgments "documents"; turning one case's
        # facts into a general rule) are restated here, not only in the system prompt.
        prompt_instruction = (
            f"Answer now, based only on the {doc_count} sources above.\n"
            "Before you write, remember:\n"
            "- Attribute to a case only what the court HELD. Facts of the case and lower-court orders it "
            "recites (e.g. 'the Family Court awarded iddat maintenance') are not holdings and must not be "
            "turned into a general rule.\n"
            "- Refer to judgments by case name or as 'the judgment' / 'the court'. Never write 'document', "
            "'documents' or 'retrieved'.\n"
            "- One ending only: practical bullets OR a one-sentence bottom line. No 'Key points' recap.\n"
            "- Use legal classifications exactly as the sources do. Never call an offence 'bailable', "
            "'non-bailable', 'cognizable' or 'compoundable' unless a source says so; 'outside the "
            "prohibitory clause, so bail is the rule' does NOT mean 'bailable'.\n"
            "- When you state what a statute, section or judgment says, quote its exact operative words "
            "in quotation marks wherever the meaning turns on them — who it applies to, 'may' versus "
            "'shall', exceptions and conditions — then explain them. Never replace a pronoun or vague "
            "reference in the source ('his', 'such person', 'the said party') with a particular person "
            "unless the text itself makes clear who is meant; if it is unclear, say so. Quotations stay "
            "in the language of the source."
        )
        if state.get("assessment_verdict") == "partial":
            prompt_instruction = (
                "REVIEWER NOTE: the judgments found only PARTLY answer this question"
                + (f" — {state.get('assessment_reason')}" if state.get("assessment_reason") else "")
                + ". Say in one sentence that the case law found does not directly settle the point, then "
                "explain what the judgments DO decide. Never claim a judgment decides an issue its text "
                "does not explicitly discuss.\n" + prompt_instruction
            )

    answer_lang = state.get("answer_language") or "en"
    answer_in_urdu = answer_lang == "ur"
    english_q = state.get("english_query") or ""
    query_line = f"Query: {state['original_query']}\n"
    if english_q and english_q != state["original_query"]:
        query_line += f"Query (English translation): {english_q}\n"
    restate = bool(state.get("restate_previous"))
    previous_answer = ""
    if restate:
        # A language switch is a TRANSLATION of the last answer, given in full —
        # never a rewrite from the (truncated) conversation, which drifted: hedges
        # vanished and holdings were invented after one or two switches.
        previous_answer = next((m.get("content", "") for m in reversed(state.get("conversation_history", []))
                                if m.get("role") in ("model", "assistant", "ai") and m.get("content")), "")
        conv_section = ""
        doc_section = f"--- PREVIOUS ANSWER (translate this) ---\n{previous_answer}\n--- END ---\n\n"
        prompt_instruction = (
            f"Translate the PREVIOUS ANSWER above into {LANGUAGE_NAMES.get(answer_lang, answer_lang)}. "
            "This is a translation, not a new answer: keep the meaning of every sentence, including "
            "qualifications such as 'only partly', 'not explicitly addressed' or 'may'; keep every case "
            "name and citation exactly; keep the same structure and Markdown. Add no facts, holdings, "
            "cases or advice that are not in it, and do not mention translation or languages."
        )
    prompt_instruction += LANGUAGE_INSTRUCTIONS.get(answer_lang, "")

    synth_messages = [
        SystemMessage(content=SYNTHESIZE_SYSTEM),
        HumanMessage(
            content=(
                f"Intent: {query_intent}\n"
                f"{query_line}"
                f"{corr_section}"
                f"{conv_section}\n"
                f"{doc_section}"
                f"{prompt_instruction}"
            )
        ),
    ]

    try:
        # Rate-limit / 5xx retries are handled inside the OpenAI client
        # (OPENAI_MAX_RETRIES, exponential backoff honouring retry-after).
        response = (llm.bind(temperature=0) if restate else llm).invoke(synth_messages)
        # When the user cited Indian law, the answer legitimately names the Indian
        # provision to explain the correction ("Section 482 CrPC is an Indian provision…");
        # blind replacement would turn that sentence into a false statement.
        answer = response.content if corrections else sanitize_indian_law_references(response.content)
        # History-only follow-ups have no retrieved docs: the prior conversation
        # (which itself came from retrieved docs) is the evidence to check against.
        evidence = previous_answer if restate else (conv_context if query_intent == "conversational_followup" else combined_context)
        answer = enforce_grounded_citations(
            answer, evidence, state["original_query"],
            extra_allowed=" ".join(corrections) + " " + (state.get("search_query") or "")
                          + " " + (state.get("english_query") or ""),
        )
    except Exception as exc:
        answer = build_conservative_fallback(state["original_query"], combined_context)
        answer = localize(answer, answer_lang)
        err_name = exc.__class__.__name__
        err_detail = str(exc).strip().replace("\n", " ")[:200]
        trace_msg = (
            f"⚠️ Synthesis LLM failed ({err_name}: {err_detail}) — returned conservative grounded response."
        )
        sources_lines = []
        for output in tool_outputs:
            for line in output.split("\n"):
                if line.startswith("[Doc"):
                    sources_lines.append(line.strip())
        return {
            "final_answer": answer,
            "sources_summary": "\n".join(sources_lines[:15]),
            "messages": [AIMessage(content=answer)],
            "agent_trace": state.get("agent_trace", []) + [trace_msg],
        }

    # Judge profile queries: NEVER use the conservative legal-filing fallback.
    # The fallback template ("Suggested Filing-Focused Next Inputs") is designed
    # for case-law grounding checks and is completely wrong for judge bios.
    # If we retrieved a judge document, always synthesise a proper profile.
    is_judge_query = (query_intent == "judge_profile")
    is_followup = (query_intent == "conversational_followup")
    is_statutory = (query_intent == "statutory_law")

    low_evidence = (not is_judge_query and not is_followup and not is_statutory and doc_count < 1)

    # The relevance gate has already confirmed (by quoting them) that the sources
    # address the question; the word-overlap heuristic below is only a backstop
    # for answers written without that confirmation.
    gate_confirmed = state.get("assessment_verdict") in ("yes", "partial") and doc_count > 0
    # Conversational follow-ups use conversation history, not retrieved docs — skip grounding.
    # Statutory law queries combine multiple tool results and discuss provisions — skip grounding.
    skip_grounding_check = is_judge_query or is_followup or is_statutory or gate_confirmed

    if not skip_grounding_check and (low_evidence or has_grounding_risk(answer, combined_context)):
        answer = build_conservative_fallback(state["original_query"], combined_context)
        answer = localize(answer, answer_lang)
        trace_suffix = " (conservative fallback due to weak grounding/evidence)"
    else:
        trace_suffix = ""

    # The chat renders Markdown only; turn any HTML <img> the model still writes into Markdown.
    answer = re.sub(r'<img[^>]*src="([^"]+)"[^>]*>', r"![](\1)", answer)

    # Surface Indian→Pakistani corrections deterministically, above the answer.
    if corrections:
        label = "نوٹ" if answer_in_urdu else "Note"
        answer = "\n".join(f"> ℹ️ **{label}:** {c}." for c in corrections) + "\n\n" + answer

    # Say how shorthand in the question was read, so a wrong reading is visible at once.
    if state.get("interpretation") and not restate:
        note = localize(state["interpretation"], answer_lang) if answer_lang != "en" else state["interpretation"]
        answer = f"> ℹ️ {note.rstrip('.')}.\n\n" + answer

    # Sources = the documents the model actually saw (post gate + budget).
    sources_lines = [line.strip() for line in combined_context.split("\n") if line.startswith("[Doc")]

    sources_summary = "\n".join(sources_lines[:15])

    trace_msg = f"✍️  Synthesizing final answer ({len(answer)} chars) from {len(tool_outputs)} tool result(s){trace_suffix}"

    if restate:
        answer_contexts = [previous_answer]
    elif query_intent == "conversational_followup":
        answer_contexts = [conv_context]
    else:
        answer_contexts = [body for _, body in blocks]

    return {
        "final_answer": answer,
        "sources_summary": sources_summary,
        "answer_contexts": answer_contexts,
        "messages": [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + [trace_msg],
    }


# --------Node: verify_answer (meaning check against the sources)----------
# The citation check confirms section numbers exist and the relevance gate that
# the judgments are on topic; neither compares MEANING. This step does: a second
# model reads the draft beside the passages it was written from and corrects any
# statement that misstates what a law or judgment says. It is general — no
# provision, topic or wording is special-cased.

VERIFY_SYSTEM = """You check a draft answer written by a legal research assistant for Pakistani lawyers against the SOURCES it was written from (statutes and judgments).

Examine every statement in the draft about what a statute, provision or judgment says, provides or held, and compare it with the sources. A statement is WRONG only when it clearly misstates the source in one of these ways:
1. Wrong subject — it applies a rule to a different person, party or thing than the source does. Work out who a pronoun or reference ("he", "his", "such person", "the said party") means from the source's own wording and context, not from the surrounding topic of the answer.
2. Wrong force — it changes "may" into "shall/must" or the reverse, drops or adds "not", or turns a discretion into a duty.
3. Wrong scope — it drops a condition, exception or limit that changes the meaning, or extends a rule beyond what the source says.
4. Facts as law — it presents the facts of a case, a party's argument or a lower court's order as what the court held or as a general rule.
5. Wrong classification or number — a legal label (bailable, cognizable, compoundable, void, voidable…), a period, an amount or a section number that differs from the source.
6. Unsupported attribution — it says a source holds or provides something that no source contains.

Do NOT report: style, tone, structure, things the answer leaves out, reasonable paraphrases that keep the meaning, practical advice, or statements the sources support. A summary of a statute in plain words is correct if it keeps who, what, may/shall and the conditions. When unsure, do not report.
Report only errors that change the legal meaning, at most 5, the most serious first.

For each wrong statement give: the sentence copied EXACTLY, character for character, from the draft (one sentence or bullet, as short as possible but unique); the problem in one line; and the corrected sentence — as close to the draft's wording as possible, same language and style, changing only what is wrong and quoting the source's operative words where the meaning turns on them. Return an empty list when nothing is wrong."""


class _AnswerCorrection(BaseModel):
    original: str = Field(description="The faulty sentence copied exactly from the draft.")
    problem: str = Field(description="What is wrong, in one line.")
    corrected: str = Field(description="The corrected sentence, same language and style as the draft.")


class AnswerReview(BaseModel):
    corrections: List[_AnswerCorrection]


def _apply_correction(answer: str, original: str, corrected: str) -> Optional[str]:
    """Replace the faulty sentence; tolerate whitespace differences. None if not found."""
    if original and original in answer:
        return answer.replace(original, corrected, 1)
    pattern = r"\s+".join(re.escape(w) for w in original.split())
    if not pattern:
        return None
    m = re.search(pattern, answer)
    return answer[:m.start()] + corrected + answer[m.end():] if m else None


def verify_answer(state: AgentState) -> dict:
    trace = list(state.get("agent_trace", []))
    answer = state.get("final_answer") or ""
    contexts = state.get("answer_contexts") or []
    # Translations of the previous answer and history-only follow-ups have no
    # sources of their own to check against; fallbacks contain no legal statements.
    if (state.get("restate_previous") or state.get("query_intent") == "conversational_followup"
            or not contexts or not answer.strip()):
        return {"answer_corrections": []}

    sources = "\n\n---\n\n".join(contexts)
    try:
        review: AnswerReview = llm_service.get_verify_llm().with_structured_output(
            AnswerReview, method="json_schema", strict=True,
        ).invoke([
            SystemMessage(content=VERIFY_SYSTEM),
            HumanMessage(content=f"QUESTION:\n{state.get('original_query', '')}\n\nSOURCES:\n{sources}\n\n"
                                 f"DRAFT ANSWER:\n{answer}"),
        ])
    except Exception as exc:
        return {"answer_corrections": [],
                "agent_trace": trace + [f"🔍 Answer self-check unavailable ({exc.__class__.__name__}) — answer kept as written"]}

    applied, missed = [], 0
    for c in (review.corrections if review else [])[:5]:
        if not c.original.strip() or not c.corrected.strip() or c.original.strip() == c.corrected.strip():
            continue
        # A corrected sentence is held to the same citation check as the draft.
        fixed = enforce_grounded_citations(c.corrected, sources, state.get("original_query", ""),
                                           extra_allowed=" ".join(state.get("corrections") or []))
        new_answer = _apply_correction(answer, c.original, fixed)
        if new_answer is None:
            missed += 1
            continue
        answer = new_answer
        applied.append({"original": c.original, "corrected": fixed, "problem": c.problem})

    if not applied:
        note = "🔍 Self-check: every statement matches its sources"
        if missed:
            note += f" ({missed} suggested fix(es) could not be placed)"
        return {"answer_corrections": [], "agent_trace": trace + [note]}
    return {
        "final_answer": answer,
        "answer_corrections": applied,
        "messages": [AIMessage(content=answer)],
        "agent_trace": trace + [f"🔍 Self-check corrected {len(applied)} statement(s): "
                                + " | ".join(a["problem"][:90] for a in applied)],
    }


# --------Nodes: conversational replies (greetings, small talk, out of scope)-----

_ASSISTANT_PROFILE = (
    "You are Justice AI, an AI legal research assistant for Pakistani lawyers. You research case law "
    "of the Supreme Court of Pakistan, Lahore High Court, Islamabad High Court and Punjab district courts (Sahiwal, Okara, Pakpattan, Kasur, Rawalpindi); explain federal and "
    "Punjab statutes; look up judge profiles; and work in English, Urdu and Roman Urdu. The app also "
    "has a Case Diary with WhatsApp hearing reminders and private PDF document analysis."
)

_CONVERSATIONAL_TASK = {
    "greeting": (
        "Reply to the user's message naturally and briefly — usually 1-3 sentences, or a short bullet "
        "list only if they ask what you can do. If they want help with a case but have not described "
        "it, ask for the facts, the stage (FIR, investigation, trial, appeal), the sections involved "
        "and the court. Do not answer legal questions here and do not invent capabilities."
    ),
    "out_of_scope": (
        "The user's message is not about law or the legal system. In 1-2 sentences, say politely that "
        "it is outside what you cover and suggest the kind of Pakistani legal question you can help with."
    ),
}
# These replies are written without any sources, so they must never state facts.
_NO_FACTS = (" Never state facts of any kind — no times, dates, fees, amounts, procedures, rules, laws, "
             "names or numbers. If the message asks for such a fact, do not guess: say you can research it "
             "and invite the user to ask it as a legal question.")


def _conversational_reply(state: AgentState, kind: str, trace_note: str) -> dict:
    lang = state.get("answer_language") or "en"
    history = state.get("conversation_history") or []
    convo = _recent_conversation(history, turns=4, max_answer=600) if history else ""
    try:
        reply = llm_service.get_llm().invoke([
            SystemMessage(content=f"{_ASSISTANT_PROFILE}\n\n{_CONVERSATIONAL_TASK[kind]}{_NO_FACTS}\n"
                                  f"Write the reply in {LANGUAGE_NAMES.get(lang, 'English')}."),
            HumanMessage(content=(f"Earlier conversation:\n{convo}\n\n" if convo else "")
                         + f"User's message: {state.get('original_query', '')}"),
        ]).content.strip()
    except Exception as exc:
        print(f"⚠️ Conversational reply failed ({exc.__class__.__name__})")
        reply = ""
    if not reply:
        reply = localize("I'm Justice AI, a legal research assistant for Pakistani law. "
                         "Ask me about case law, statutes or judges.", lang)
    return {
        "final_answer": reply,
        "sources_summary": "",
        "messages": [AIMessage(content=reply)],
        "agent_trace": state.get("agent_trace", []) + [trace_note],
    }


def respond_greeting(state: AgentState) -> dict:
    return _conversational_reply(state, "greeting", "👋 Conversational message — replied without searching")


def respond_out_of_scope(state: AgentState) -> dict:
    return _conversational_reply(state, "out_of_scope", "⛔ Outside Pakistani law — replied without searching")


# --------Node: respond_insufficient_data-------------

def respond_insufficient_data(state: AgentState) -> dict:
    tool_outputs = []
    for msg in state.get("messages", []):
        if isinstance(msg, ToolMessage):
            tool_outputs.append(msg.content)
    combined = "\n\n".join(tool_outputs)
    answer = build_conservative_fallback(state.get("original_query", ""), combined)
    answer = localize(answer, state.get("answer_language") or "en")

    src_lines = []
    for output in tool_outputs:
        for line in output.split("\n"):
            if line.startswith("[Doc"):
                src_lines.append(line.strip())

    return {
        "final_answer": answer,
        "sources_summary": "\n".join(src_lines[:15]),
        "messages": [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + [
            "🛑 Retrieval stayed weak after retries — returned conservative grounded response."
        ],
    }


# --------Node: respond_clarify-------------

def respond_clarify(state: AgentState) -> dict:
    """Ask the user to confirm an unclear reference (written by the understanding step)."""
    lang = state.get("answer_language") or "en"
    question = state.get("clarification") or "Could you tell me which law and section you mean?"
    if lang == "ur" and urdu_ratio(question) < 0.3:
        question = localize(question, lang)   # اردو toggle is on but the message was not in Urdu
    return {
        "final_answer": question,
        "sources_summary": "",
        "messages": [AIMessage(content=question)],
        "agent_trace": state.get("agent_trace", []) + ["❓ Asked the user to confirm the reference"],
    }


# --------Node: respond_search_unavailable-------------

def respond_search_unavailable(state: AgentState) -> dict:
    """The search service (embeddings or vector database) could not be reached.
    Say so plainly — this is an outage, not a question the collection cannot answer."""
    answer = localize(
        "### ⚠️ Search Is Temporarily Unavailable\n\n"
        "I could not reach the legal database to research this question, so I am not giving an answer "
        "rather than guessing. Nothing is wrong with your question — please try again in a minute.",
        state.get("answer_language") or "en",
    )
    return {
        "final_answer": answer,
        "sources_summary": "",
        "messages": [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + ["🛑 Search outage reported to the user"],
    }


# Router: route_after_understand
def route_after_understand(state: AgentState) -> Literal["dispatch_search", "respond_out_of_scope", "respond_greeting", "respond_clarify", "synthesize_answer"]:
    intent = state.get("query_intent", "case_law")
    if intent == "clarify":
        return "respond_clarify"
    if intent == "greeting":
        return "respond_greeting"
    if intent == "out_of_scope":
        return "respond_out_of_scope"
    if intent == "conversational_followup":
        return "synthesize_answer"
    return "dispatch_search"


# Router: route_after_evaluate
def route_after_evaluate(
    state: AgentState,
) -> Literal["verify_grounding", "refine_and_retry", "respond_insufficient_data", "respond_search_unavailable"]:
    if state.get("search_failed"):
        return "respond_search_unavailable"
    if state.get("results_sufficient", False):
        return "verify_grounding"
    if state.get("retry_count", 0) >= MAX_RETRIES:
        return "respond_insufficient_data"
    return "refine_and_retry"


# Router: route_after_verify
def route_after_verify(state: AgentState) -> Literal["assess_relevance", "refine_and_retry"]:
    # verify_grounding only reports "not sufficient" while a retry is still available.
    return "assess_relevance" if state.get("results_sufficient", False) else "refine_and_retry"


# Router: route_after_assess
def route_after_assess(state: AgentState) -> Literal["synthesize_answer", "respond_not_covered"]:
    return "synthesize_answer" if state.get("answerable", True) else "respond_not_covered"
