import re
from difflib import SequenceMatcher
from typing import Annotated, List, Optional, Literal, TypedDict

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    BaseMessage,
)
from langgraph.graph.message import add_messages

from backend.services.llm import llm_service
from backend.services.tools import ALL_TOOLS
from backend.services.prompts import format_conversation_history
from backend.services.query_rewriter import query_rewriter_service


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


_JUDGE_KEYWORDS = [
    "justice ", "judge ", "who is judge", "judge profile", "judges of",
    "chief justice", "sitting judges", "former judges", "judges list",
    "biography of judge", "bio of justice", "hierarchy of judges",
    "all judges", "senior judges", "judges at", "judges in",
    "judges from", "judges named", "current judges", "former chief justices",
    "about judge", "about justice", "judicial", "bench",
    "list judges", "judges with", "judges experience", "judicial experience",
]

_GREETING_KEYWORDS = [
    "hello", "hi", "hey", "salaam", "assalam", "greetings", "good morning",
    "good evening", "good night", "aoa", "asalam o alaikum", "assalamualaikum",
    "how are you", "what is your name", "who are you",
    "thank you", "thanks", "shukriya", "jazakallah", "thanks a lot",
    "you are helpful", "very helpful", "great job", "good job", "well done",
    "bye", "goodbye", "see you", "take care",
]

_CAPABILITY_PATTERNS = [
    "what can you do", "what do you do", "how can you help", "help me",
    "tell me about yourself", "introduce yourself", "your capabilities",
    "what services", "what features", "what can i ask",
]

_LEGAL_KEYWORDS = [
    "law", "legal", "court", "case", "judgment", "judgement", "judge", "justice",
    "petition", "appeal", "bail", "fir", "ppc", "cr.p.c", "crpc", "section", "act",
    "article", "constitution", "lahore high court", "supreme court", "islamabad high court",
    "pld", "yld", "mld", "civil", "criminal", "family law", "property law",
]

_STRICT_LEGAL_QUERY_MARKERS = [
    "section", "article", "fir", "petition", "appeal", "bail", "ppc", "crpc",
    "cr p c", "constitutional", "quash", "injunction", "limitation", "citation",
]

_OUT_OF_SCOPE_KEYWORDS = [
    "recipe", "weather", "movie", "song", "cricket score", "football",
    "stock price", "bitcoin", "horoscope", "tell me a joke",
]

_OUT_OF_SCOPE_PATTERNS = [
    "weather today", "who is elon musk", "news today", "sports update",
    "movie recommendation", "stock market", "crypto price", "joke",
    "recipe", "cooking", "travel plan", "fitness tips",
]


def normalize_text(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def contains_any(text: str, patterns: List[str]) -> bool:
    return any(p in text for p in patterns)


def token_set(text: str) -> set:
    return set(normalize_text(text).split())


def fuzzy_contains(text: str, patterns: List[str], threshold: float = 0.84) -> bool:
    """Typos-tolerant phrase check for short conversational intents."""
    t = normalize_text(text)
    for p in patterns:
        p_norm = normalize_text(p)
        if p_norm in t:
            return True
        ratio = SequenceMatcher(None, t, p_norm).ratio()
        if ratio >= threshold:
            return True
    return False


def looks_like_capability_query(query: str) -> bool:
    """Detect capability questions, including common typos like 'wat you can do'."""
    q = normalize_text(query)
    tokens = token_set(q)

    if contains_any(q, _CAPABILITY_PATTERNS) or fuzzy_contains(q, _CAPABILITY_PATTERNS, threshold=0.80):
        return True

    has_you = "you" in tokens or "u" in tokens
    has_can = "can" in tokens
    has_do = "do" in tokens or "help" in tokens
    has_ask = "ask" in tokens or "queries" in tokens or "query" in tokens
    has_what = any(w in tokens for w in ["what", "wat", "whats", "wht"])
    has_who = "who" in tokens

    # e.g. "wat you can do", "who are you", "what can i ask"
    if has_you and ((has_what and has_can and has_do) or has_who or (has_can and has_ask)):
        return True

    return False


def is_judge_biography_query(query: str) -> bool:
    """
    Detect judge biography queries like:
    - 'Tell me about Khadim Hussain Soomro' (judge name only)
    - 'Who is Justice Aalia Neelum?' (with title)
    - 'Tell me about Chief Justice Munib Akhtar' (with rank)
    - 'tell me about khadim hussain soomro' (lowercase - common case)
    """
    biography_markers = [
        "who is", "who are", "tell me about", "tell us about", "introduced",
        "biography", "background", "life of", "profile of",
        "education of", "career of", "personal", "info about",
        # NOTE: bare "about" removed — too generic, matches "say about", "about consideration"
    ]
    q_norm = normalize_text(query)
    has_bio_marker = any(m in q_norm for m in biography_markers)
    
    # Exclude case/verdict/statute patterns (these are definitely NOT judge biographies)
    case_exclude_patterns = [
        "cases", "case", "verdict", "judgment", "judgement",
        "written", "presided", "heard", "decided", "ruled",
        "article", "section", "petition", "appeal",
        # Statute/law terms that indicate non-biography queries
        "act ", " act", "ordinance", "statute", "law ", " law",
        "provision", "bail", "fir ", "murder", "offence", "offense",
        "crime", "criminal", "civil", "writ", "habeas", "mandamus",
        "injunction", "consideration", "agreement", "contract",
        "property", "evidence", "limitation", "registration",
    ]
    has_case_pattern = any(p in q_norm for p in case_exclude_patterns)
    
    # Check for judge-related terms OR person name patterns
    judge_terms = ["judge", "justice", "justices", "chief", "senior", "retired"]
    has_judge_term = any(t in q_norm for t in judge_terms)
    
    # For queries like "Tell me about Khadim Hussain Soomro" (just bio marker + proper noun)
    # Accept if: has biography marker AND (has judge term OR has proper noun pattern)
    # Try both uppercase pattern (formal) and just detect multi-word names (casual lowercase)
    has_proper_noun = bool(re.search(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', query))
    
    # Filter out legal terms that look like proper nouns but aren't person names
    if has_proper_noun:
        _LEGAL_NOUNS = {
            "contract", "act", "section", "article", "court", "high",
            "supreme", "federal", "provincial", "punjab", "sindh",
            "balochistan", "islamabad", "lahore", "criminal", "civil",
            "family", "evidence", "limitation", "registration", "stamp",
            "transfer", "property", "companies", "partnership",
            "specific", "relief", "arbitration", "revenue",
        }
        # Check if the matched proper noun pattern is actually a legal term
        matches = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', query)
        real_names = [m for m in matches if not all(w.lower() in _LEGAL_NOUNS for w in m.split())]
        has_proper_noun = len(real_names) > 0
    
    # Also detect multi-word lowercase names (e.g., "khadim hussain soomro")
    # Pattern: word + space + word + space + word (at least 3 parts = likely a name)
    if not has_proper_noun:
        words_in_query = query.split()
        # Remove common words that aren't part of names
        common_words = {"tell", "me", "about", "us", "who", "what", "is", "are", "the", "a", "and", "or", "who",
                        "does", "do", "did", "can", "could", "say", "says", "said", "in", "of", "for", "to",
                        "how", "when", "where", "which", "with", "from", "by", "on", "at", "under", "over"}
        # Also exclude legal terms
        legal_words = {
            "contract", "act", "section", "article", "court", "law", "legal",
            "consideration", "agreements", "agreement", "bail", "murder", "fir",
            "evidence", "property", "criminal", "civil", "writ", "petition",
            "appeal", "case", "cases", "judgment", "provision", "statute",
            "ordinance", "powers", "rights", "grounds", "procedure",
        }
        exclude = common_words | legal_words
        name_words = [w for w in words_in_query if w.lower() not in exclude and len(w) > 1]
        # If we have 2+ potential name words after filtering, likely a person name
        has_proper_noun = len(name_words) >= 2
    
    # Also detect single-word capitalized names like "Bashir", "Abbasi" (4+ chars, starts with capital)
    # This handles queries like "Who is Bashir?" or "Tell me about Abbasi"
    if not has_proper_noun:
        single_word_pattern = r'\b[A-Z][a-z]{3,}\b'  # Capital letter + 4+ lowercase letters
        single_word_matches = re.findall(single_word_pattern, query)
        if single_word_matches:
            # Check if any match isn't a common word or legal term
            common_single_words = {"tell", "about", "these", "those", "what", "when", "where", "which",
                                   "contract", "section", "article", "court", "evidence", "criminal"}
            for match in single_word_matches:
                if match.lower() not in common_single_words:
                    has_proper_noun = True
                    break
    
    return (has_bio_marker and not has_case_pattern and 
            (has_judge_term or has_proper_noun))


from langchain_core.messages import SystemMessage

def classify_intent(query: str) -> str:
    """Deterministic low-latency intent router (no LLM/network call)."""
    return fallback_classify_intent(query)


def fallback_classify_intent(query: str) -> str:
    """Fallback hardcoded classification if LLM fails."""
    ql = normalize_text(query)
    q_norm = ql

    if len(ql) <= 2 and ql.isalpha():
        return "greeting"

    has_legal_signal = contains_any(ql, _LEGAL_KEYWORDS)
    has_strict_legal_marker = contains_any(ql, _STRICT_LEGAL_QUERY_MARKERS)

    greeting_exact = ql in _GREETING_KEYWORDS
    greeting_short = len(ql.split()) <= 8 and contains_any(ql, _GREETING_KEYWORDS)
    capability_query = looks_like_capability_query(query)

    # Identity/capability prompts should always map to greeting intent.
    if ql in {"who are you", "what is your name", "what can you do", "how can you help"}:
        return "greeting"

    if contains_any(ql, _OUT_OF_SCOPE_PATTERNS) or fuzzy_contains(ql, _OUT_OF_SCOPE_PATTERNS, threshold=0.86):
        return "out_of_scope"

    # Generic personality/entity questions should not be treated as judge profiles
    # unless legal context exists in the query.
    if (ql.startswith("who is ") or ql.startswith("who are ")) and not has_legal_signal and not contains_any(ql, _JUDGE_KEYWORDS):
        return "out_of_scope"

    # PRIORITY: Check for judge biography queries FIRST (before greeting patterns)
    # This prevents "Who is Bashir?" from being classified as greeting
    if is_judge_biography_query(query):
        return "judge_profile"

    # Judge listing queries should also route to the judge-profile branch.
    if any(p in q_norm for p in [
        "judges from", "judges named", "current judges", "former judges",
        "sitting judges", "chief justices", "judges with", "list judges",
        "all judges", "senior judges", "judges in", "judges at",
    ]):
        return "judge_profile"

    # Check for explicit judge keywords
    if contains_any(ql, _JUDGE_KEYWORDS):
        return "judge_profile"

    # ── Statutory law intent ──────────────────────────────────────────
    # Detect queries asking about specific acts, statutes, ordinances,
    # or legal provisions that are better answered from the law corpus.
    _STATUTE_MARKERS = [
        "act ", " act", "ordinance", "statute", "statutes",
        "provision", "provisions", "law says", "what does the law",
        "under the law", "according to law", "federal law",
        "punjab law", "punjab tenancy", "rent restriction",
        "contract act", "penal code", "evidence act",
        "limitation act", "guardians and wards", "family courts act",
        "muslim family laws", "transfer of property", "stamp act",
        "registration act", "specific relief", "companies act",
        "partnership act", "arbitration act", "land revenue act",
        "west pakistan", "sindh", "balochistan",
    ]
    if any(m in ql for m in _STATUTE_MARKERS) and has_legal_signal:
        return "statutory_law"

    if capability_query and not has_strict_legal_marker:
        return "greeting"

    if (greeting_exact or greeting_short or capability_query) and not has_legal_signal:
        return "greeting"

    if has_legal_signal:
        return "case_law"

    if contains_any(ql, _OUT_OF_SCOPE_KEYWORDS):
        return "out_of_scope"

    return "case_law"


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


def is_complex_query(query: str) -> bool:
    """Heuristic complexity detector for long, multi-part legal prompts."""
    q = normalize_text(query)
    words = q.split()
    if len(words) >= 45:
        return True

    multi_part_markers = [
        " and ", " also ", " additionally ", " furthermore ",
        " explain ", " include ", " guidance ", " roadmap ",
        " what are ", " what is ", " how ", " when ",
    ]
    marker_hits = sum(1 for m in multi_part_markers if m in f" {q} ")
    punctuation_hits = query.count("?") + query.count(":") + query.count(";")
    return marker_hits >= 3 or punctuation_hits >= 2


def build_query_variants(query: str, max_variants: int = 3) -> List[str]:
    """Create focused sub-queries from a long prompt for broader evidence coverage."""
    normalized = re.sub(r"\s+", " ", query).strip()
    if not normalized:
        return []

    parts = [p.strip(" -\t\n") for p in re.split(r"[\?;]|\band\b|\balso\b|\badditionally\b", normalized, flags=re.IGNORECASE)]
    parts = [p for p in parts if len(p.split()) >= 5]

    variants = [normalized]
    for p in parts:
        if p not in variants:
            variants.append(p)

    # Keep original first, then shortest useful focused clauses.
    focused = [variants[0]] + sorted(variants[1:], key=lambda x: len(x.split()))
    return focused[:max_variants]


def is_followup_query(query: str, history: List[dict]) -> bool:
    if not history:
        return False
    q_norm = normalize_text(query)
    # Exclude strict independent legal queries
    if "pld" in q_norm or "clc" in q_norm or "scmr" in q_norm or "yld" in q_norm:
        return False

    followup_keywords = [
        "this case", "these cases", "the judgment", "this judgment", "the judgement", 
        "explain further", "what are the advantages", "what are its", "its advantages",
        "tell me more", "the previous", "what about him", "what about her",
        "what does it mean", "explain this", "summarize it", "summarize this", "summary",
        "what are the grounds", "why was it", "who was the judge",
        "advantages of this", "disadvantages of this", "explain that", "what does that mean"
    ]
    if any(k in q_norm for k in followup_keywords):
        return True
    
    # If it is clearly a greeting (even a slightly longer one like "that's great good morning"), 
    # don't treat it as a conversational followup to the legal topic.
    if any(g in q_norm for g in _GREETING_KEYWORDS) and len(q_norm.split()) <= 8:
        return False
    
    # Very short queries imply continuation (e.g., "what about FIR?")
    if len(q_norm.split()) <= 4:
        return True
        
    return False


# -------Query contextualization (makes follow-ups standalone)---------

CONTEXTUALIZE_SYSTEM = (
    "You rewrite the user's latest message into a single standalone legal search query, "
    "using the prior conversation only to resolve references. Turn vague references like "
    "'that case', 'its punishment', 'the judge', 'this section', 'explain further' into "
    "explicit terms drawn from the conversation. "
    "Output ONLY the rewritten query on one line — no quotes, no explanation, no preamble. "
    "If the latest message is already self-contained, output it unchanged."
)


def contextualize_query(query: str, history: List[dict]) -> str:
    """Resolve a follow-up message into a standalone query via the LLM.

    Falls back to the original query on any failure. Greetings/thanks are
    handled by the caller and never reach here.
    """
    if not history:
        return query
    try:
        llm = llm_service.get_llm()
        convo = format_conversation_history(history)
        messages = [
            SystemMessage(content=CONTEXTUALIZE_SYSTEM),
            HumanMessage(content=f"{convo}\n\nLatest message: {query}\n\nStandalone query:"),
        ]
        resp = llm.invoke(messages)
        rewritten = (resp.content or "").strip().strip('"').strip()
        if rewritten and 2 <= len(rewritten) <= 400 and "\n" not in rewritten:
            return rewritten
    except Exception:
        pass
    return query


# -------Node: understand_query---------

def understand_query(state: AgentState) -> AgentState:
    query = state["original_query"]
    history = state.get("conversation_history", [])

    # Resolve follow-ups into a standalone query so they retrieve fresh evidence
    # (ChatGPT/Claude-style). Skip pure greetings/thanks to save an LLM call.
    ql = normalize_text(query)
    is_greetingish = len(ql.split()) <= 8 and contains_any(ql, _GREETING_KEYWORDS)
    trace: List[str] = list(state.get("agent_trace", []))

    if history and not is_greetingish:
        search_query = contextualize_query(query, history)
        if search_query != query:
            trace.append(f"🔗 Follow-up resolved → '{search_query[:90]}'")
    else:
        search_query = query

    intent = classify_intent(search_query)
    trace.append(f"🔍 Query classified | Intent: {intent}")

    new_messages = [HumanMessage(content=search_query)]
    variants = query_rewriter_service.rewrite_query(search_query, max_variants=None)

    return {
        **state,
        "messages": new_messages,
        "search_query": search_query,
        "query_intent": intent,
        "query_variants": variants,
        "retry_count": 0,
        "results_sufficient": False,
        "agent_trace": trace,
    }


# --------Node: dispatch_search---------

def dispatch_search(state: AgentState) -> AgentState:
    query = state.get("search_query") or state["original_query"]
    intent = state.get("query_intent", "case_law")
    filters = state.get("filters") or {}
    query_variants = state.get("query_variants") or [query]
    complex_query = is_complex_query(query)

    if intent == "judge_profile":
        tool_call = {
            "name": "search_judge_profiles",
            "args": {"query": query},
            "id": "deterministic_dispatch_0",
            "type": "tool_call",
        }
        trace_msg = "⚡ Deterministic dispatch → search_judge_profiles"
        tool_calls = [tool_call]

    elif intent == "statutory_law":
        # Full pipeline already searches case law + statute corpora via hybrid.
        tool_calls = [{
            "name": "retrieve_with_full_pipeline",
            "args": {"query": query},
            "id": "deterministic_dispatch_0",
            "type": "tool_call",
        }]
        trace_msg = "⚡ Deterministic dispatch → retrieve_with_full_pipeline (statutory_law intent)"

    else:
        court_filter = str(filters.get("court", "")).strip()
        year_filter = str(filters.get("year", "")).strip()
        provision_markers = extract_provision_markers(query)

        if court_filter:
            tool_calls = [{
                "name": "search_by_court_and_topic",
                "args": {"court": court_filter, "topic": query},
                "id": "deterministic_dispatch_0",
                "type": "tool_call",
            }]
            trace_msg = "⚡ Deterministic dispatch → search_by_court_and_topic (user court filter)"
        elif year_filter:
            tool_calls = [{
                "name": "search_by_year_and_topic",
                "args": {"year": year_filter, "topic": query},
                "id": "deterministic_dispatch_0",
                "type": "tool_call",
            }]
            trace_msg = "⚡ Deterministic dispatch → search_by_year_and_topic (user year filter)"
        elif provision_markers:
            # Provision-focused: full pipeline covers all case types + statutes.
            tool_calls = [{
                "name": "retrieve_with_full_pipeline",
                "args": {"query": query},
                "id": "deterministic_dispatch_0",
                "type": "tool_call",
            }]
            trace_msg = "⚡ Deterministic dispatch → retrieve_with_full_pipeline (provision-focused)"
        elif complex_query:
            # Complex multi-part queries: one broad hybrid search over the full corpus.
            tool_calls = [{
                "name": "retrieve_with_full_pipeline",
                "args": {"query": query},
                "id": "deterministic_dispatch_0",
                "type": "tool_call",
            }]
            trace_msg = "⚡ Deterministic dispatch → retrieve_with_full_pipeline (complex query)"
        else:
            tool_calls = [{
                "name": "search_case_law",
                "args": {"query": query_variants[0]},
                "id": "deterministic_dispatch_0",
                "type": "tool_call",
            }]
            trace_msg = "⚡ Deterministic dispatch → search_case_law (1 variant)"

    ai_msg = AIMessage(
        content="",
        tool_calls=tool_calls,
    )

    return {
        **state,
        "messages": state["messages"] + [ai_msg],
        "agent_trace": state.get("agent_trace", []) + [trace_msg],
    }


# --------Node: evaluate_results---------

def evaluate_results(state: AgentState) -> AgentState:
    # Only evaluate the LATEST batch of ToolMessages (those produced after the most
    # recent AIMessage with tool_calls). This prevents stale "NO MATCHING DATA"
    # from a failed retry blocking evaluation of a successful subsequent retry.
    messages = state["messages"]
    last_dispatch_idx = -1
    for i, msg in enumerate(messages):
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            last_dispatch_idx = i

    tool_outputs = []
    start_idx = last_dispatch_idx + 1 if last_dispatch_idx >= 0 else 0
    for msg in messages[start_idx:]:
        if isinstance(msg, ToolMessage):
            tool_outputs.append(msg.content)

    if not tool_outputs:
        return {
            **state,
            "results_sufficient": False,
            "agent_trace": state.get("agent_trace", []) + ["⚠️  No tool results yet — retrying..."],
        }

    combined = "\n\n".join(tool_outputs)

    if "NO MATCHING DATA" in combined or "No documents found" in combined:
        return {
            **state,
            "results_sufficient": False,
            "agent_trace": state.get("agent_trace", []) + ["⚠️  No matching documents — retrying..."],
        }

    # _format_results outputs "[Doc N of M]" — check for that exact format
    has_docs = "[Doc " in combined
    if not has_docs:
        # Check if the tool actually returned NO RESULTS FOUND
        if (
            "⚠️ NO RESULTS FOUND" in combined
            or "⚠️ NO RESULTS" in combined
            or "NO MATCHING DATA" in combined
        ):
            return {
                **state,
                "results_sufficient": False,
                "agent_trace": state.get("agent_trace", []) + [
                    "⚠️  No retrieved documents — need to call a search tool..."
                ],
            }

    if has_docs:
        import re as _re
        # Match "score=0.123" format produced by _format_results
        scores = [float(s) for s in _re.findall(r'score=([\d\.]+)', combined)]
        best_score = max(scores) if scores else 0.0
        doc_count = combined.count("[Doc ")

        # Judge profiles with score 10.0 (exact name matches) are always sufficient
        if state.get("query_intent") == "judge_profile" and best_score >= 8.0:
            return {
                **state,
                "results_sufficient": True,
                "agent_trace": state.get("agent_trace", []) + [f"✅ Excellent judge profile match (score={best_score:.1f})"],
            }
        
        # General relevancy threshold check
        if best_score >= 0.35:
            return {
                **state,
                "results_sufficient": True,
                "agent_trace": state.get("agent_trace", []) + [f"✅ Sufficient results (best_score={best_score:.2f})"],
            }

    # If we reached here, results are either missing or too low quality.
    # Cap at a single retry — full-corpus hybrid rarely benefits from more, and
    # each extra round adds ~2s (embed + hybrid + rerank).
    retry_count = state.get("retry_count", 0)
    if retry_count >= 1:
        return {
            **state,
            "results_sufficient": True, # Give up and summarize
            "agent_trace": state.get("agent_trace", []) + ["🛑 Max retries reached — synthesizing with available context."],
        }

    return {
        **state,
        "results_sufficient": False,
        "retry_count": retry_count + 1,
        "agent_trace": state.get("agent_trace", []) + [f"🔄 Insufficient results — retrying ({retry_count+1}/2)..."],
    }


def refine_and_retry(state: AgentState) -> AgentState:
    retry = state.get("retry_count", 0) + 1
    query = state.get("search_query") or state.get("original_query", "")
    variants = state.get("query_variants") or query_rewriter_service.rewrite_query(query, max_variants=None)

    if retry == 1:
        tool_calls = [
            {
                "name": "retrieve_with_full_pipeline",
                "args": {"query": sub_q},
                "id": f"retry_{retry}_{i}",
                "type": "tool_call",
            }
            for i, sub_q in enumerate(variants[:2])
        ]
    elif retry == 2:
        tool_calls = [
            {
                "name": "search_case_law",
                "args": {"query": sub_q},
                "id": f"retry_{retry}_{i}",
                "type": "tool_call",
            }
            for i, sub_q in enumerate(variants[:2])
        ]
    else:
        query_lower = query.lower()
        if "supreme" in query_lower or "sc " in query_lower:
            court = "Supreme Court of Pakistan"
            tool_calls = [{
                "name": "search_by_court_and_topic",
                "args": {"court": court, "topic": variants[0] if variants else query},
                "id": f"retry_{retry}_0",
                "type": "tool_call",
            }]
        elif "islamabad" in query_lower or "ihc" in query_lower:
            court = "Islamabad High Court"
            tool_calls = [{
                "name": "search_by_court_and_topic",
                "args": {"court": court, "topic": variants[0] if variants else query},
                "id": f"retry_{retry}_0",
                "type": "tool_call",
            }]
        else:
            tool_calls = [{
                "name": "retrieve_with_full_pipeline",
                "args": {"query": variants[0] if variants else query},
                "id": f"retry_{retry}_0",
                "type": "tool_call",
            }]

    response = AIMessage(content="", tool_calls=tool_calls)
    tool_names = [tc["name"] for tc in tool_calls]
    trace_msg = f"🔄 Retry {retry}/3 | Deterministic strategy: {', '.join(tool_names)}"

    return {
        **state,
        "messages": state["messages"] + [response],
        "retry_count": retry,
        "agent_trace": state.get("agent_trace", []) + [trace_msg],
    }


SYNTHESIZE_SYSTEM = """You are **Wakeels AI**, a Pakistani legal research assistant for practicing lawyers. Answer using ONLY the retrieved documents below. Extract real facts, names, dates, quotes — never fabricate.

## RULES
1. **Only retrieved docs**: No outside knowledge. If data is missing, say so.
2. **No fabricated briefs**: Only create 🔷 case cards for documents you HAVE. Cases merely cited inside another judgment get a text mention only — never a full card.
3. **No overgeneralization**: State the specific legal context each provision applies to. If docs cover only one aspect of a broad topic, say so.
4. **Correct court attribution**: Keep each case tied to its actual court (Supreme Court, Islamabad High Court, Lahore High Court). If a judgment quotes another court, do not mislabel the source court.
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
9. **IRRELEVANT RESULTS**: If the retrieved documents do NOT explicitly mention the specific Act, Law, or Topic the user asked about, DO NOT create case cards for them. Instead, clearly state: "The specific Act or topic you asked about is not currently available in my database." DO NOT provide a factual breakdown of irrelevant cases just because they were retrieved.

---
## FORMAT C — JUDGE BIOGRAPHY (intent = judge_biography)
**THIS IS A JUDGE BIOGRAPHY QUERY.** Only provide information ABOUT the judge as a person — background, education, career timeline, personal details.
**DO NOT create case cards.** Do NOT list cases. Just extract and present biographical facts from the retrieved documents.

### ⚖️ Judge Biography
Provide the following sections **ONLY if present in documents**:
- **Name & Designation:** Full name, current/former position
- **🎓 Education:** University, law school, certifications — exact details from doc only
- **📅 Career Timeline:** Years and positions held, exact dates from documents
- **⚖️ Judicial Philosophy / Notable Approach:** Any judicial philosophy mentioned in docs
- **🏛️ Administrative Roles:** Any administrative positions held
- **Personal Details:** Any biographical details (birthplace, family, languages, hobbies) from docs

**CRITICAL: NO CASE CARDS. NO VERDICTS LISTED.** Just judge info. If no info available, say \"Information not available in retrieved documents.\"

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
- **Appointed:** Date if available
- **Court:** Full court name

**Visual:** If image_url exists: `<img src="image_url" width="200" height="250" />`

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

---

## FORMAT B — CASE LAW / LEGAL ANALYSIS (all other intents)

### ⚖️ Direct Answer
2-4 sentences. **DIRECTLY answer the user's specific question first.** If they ask \"is X valid?\" — state yes/no with the legal position. If they ask \"what are my rights?\" — list the specific rights. If they ask about shares — give the actual calculation. Then scope what the docs cover.

### 📋 Case Analysis
One 🔷 card per RELEVANT retrieved case only. **SKIP cases that do not address the user's actual question** — do NOT create a card just because you retrieved it. If a case is about bail but the user asked about self-defence, skip it. Only keep cases that genuinely help answer the query.
**CRITICAL: Each case brief MUST be unique.** Read each document carefully and extract DIFFERENT specific details. Do NOT write the same generic summary for every case — if two briefs look identical, you are doing it wrong. Pull specific names, dates, section numbers, quotes, and facts that make each case distinct.
For lawyer-use answers, include as much retrievable detail as possible from each judgment: procedural posture, factual timeline, issues framed, legal test applied, and final disposition.

> #### 🔷 *Case Name* — *Citation*
> | Field | Detail |
> |---|---|
> | **Court** | From metadata |
> | **Judge(s)** | Extract real names |
> | **Parties** | Real names |
> | **Advocates** | Real names |
>
> **📌 Facts:** Specific narrative from doc — what happened, who did what, specific details.
> **⚡ Charges:** PPC sections if in doc. **Omit this field entirely for civil/constitutional matters where no criminal charges apply.**
> **🔍 Reasoning:** Quote the court: > *\"actual quote from this specific document\"*
> **📣 Verdict:** Actual outcome.
> **🎯 Relevance:** 1-2 sentences on why THIS specific case matters.
> **🧭 Procedural Stage:** Trial / appeal / revision / constitutional petition / bail stage — only if present in document.
> **⏱️ Timeline Notes:** Important dated events (filing, incident, order, final decision) if present.

**IMPORTANT**: Each document includes a [CASE HEADER] section (with judge names, parties, advocates) AND a [CASE PASSAGE] with extended context (multiple surrounding chunks). Extract judge/advocate names from the CASE HEADER. Extract facts, reasoning, procedural stage, timeline notes, and verdict from the CASE PASSAGE. If any detail is genuinely not in either section, write \"Not stated in judgment\" instead of \"Not available in retrieved text\".

### 📜 Laws & Provisions
| Statute | Section(s) | Provision |
|---------|-----------|-----------|

### 🧭 Practical Strategy
Numbered advice points.
**CRITICAL: Your strategy MUST be consistent with the legal principles in the Case Analysis above. If a case says X is NOT a final order, do not advise treating it as a final order. Re-read your case analysis before writing strategy to avoid self-contradiction.**

---

## GLOBAL
- *Italic* case names, **bold** citations, `---` between sections.
- If multiple provisions apply, use a comparison table.
- If docs partially answer, state what IS and ISN'T covered.
- No Sources/References section (shown separately). No PDF links.
"""


import re as _re

_INDIAN_LAW_REPLACEMENTS = [
    (_re.compile(r'Section\s+482\s+Cr\.?P\.?C\.?', _re.IGNORECASE), 'Section 561-A Cr.P.C.'),
    (_re.compile(r'S\.\s*482\s+Cr\.?P\.?C\.?', _re.IGNORECASE), 'S. 561-A Cr.P.C.'),
    (_re.compile(r'Section\s+498[\s-]*A\s+(?:IPC|PPC)', _re.IGNORECASE), 'Section 498 Cr.P.C. (Criminal Procedure)'),
    (_re.compile(r'498[\s-]*A\s+(?:IPC|PPC)', _re.IGNORECASE), '498 Cr.P.C.'),
    (_re.compile(r'\bIPC\b'), 'PPC'),
    (_re.compile(r'\bIndian Penal Code\b', _re.IGNORECASE), 'Pakistan Penal Code'),
    (_re.compile(r'Cr\.?P\.?C\.?\s*,?\s*1973', _re.IGNORECASE), 'Cr.P.C. 1898'),
    (_re.compile(r'Code of Criminal Procedure,?\s*1973', _re.IGNORECASE), 'Code of Criminal Procedure, 1898'),
    (_re.compile(r'Indian Evidence Act', _re.IGNORECASE), 'Qanun-e-Shahadat Order, 1984'),
]

_SECTION_REF_RE = _re.compile(r'\b(Section|S\.)\s*([0-9]{1,4}[A-Za-z\-]*)\b', _re.IGNORECASE)
_ARTICLE_REF_RE = _re.compile(r'\bArticle\s*([0-9]{1,3}[A-Za-z\-]*)\b', _re.IGNORECASE)


def sanitize_indian_law_references(text: str) -> str:
    for pattern, replacement in _INDIAN_LAW_REPLACEMENTS:
        text = pattern.sub(replacement, text)
    return text


def enforce_grounded_citations(answer: str, retrieved_context: str, original_query: str = "") -> str:
    """Strip legal provision references that appear in the LLM answer but NOT in
    the retrieved context.  However, if the user's *original query* explicitly
    mentioned a provision (e.g. "Article 199"), the LLM is expected to discuss
    it — stripping it would destroy a valid answer."""
    ctx = retrieved_context.lower()
    q_lower = (original_query or "").lower()

    def section_repl(match):
        token = match.group(2)
        # Keep if the user asked about this section
        if _re.search(rf'\bsection\s*{_re.escape(token)}\b', q_lower, _re.IGNORECASE):
            return match.group(0)
        sec_pattern = rf'\b(?:section|s\.)\s*{_re.escape(token)}\b'
        if _re.search(sec_pattern, ctx, _re.IGNORECASE):
            return match.group(0)
        return "the cited provision"

    def article_repl(match):
        token = match.group(1)
        # Keep if the user asked about this article
        if _re.search(rf'\barticle\s*{_re.escape(token)}\b', q_lower, _re.IGNORECASE):
            return match.group(0)
        art_pattern = rf'\barticle\s*{_re.escape(token)}\b'
        if _re.search(art_pattern, ctx, _re.IGNORECASE):
            return match.group(0)
        return "the cited constitutional provision"

    answer = _SECTION_REF_RE.sub(section_repl, answer)
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
        bullets.append("- No sufficiently grounded source lines were available.")

    return (
        "### Grounded Response\n"
        "The retrieved evidence does not support a fully confident final legal conclusion for every part of your query. "
        "To avoid hallucinations, I am limiting the response to what is clearly grounded in retrieved Supreme Court and Islamabad High Court material.\n\n"
        "### What Was Retrieved\n"
        + "\n".join(bullets)
        + "\n\n"
        "### What Can Be Safely Inferred\n"
        "- The currently retrieved judgments indicate related legal context, but not enough claim-level evidence for a definitive full answer.\n"
        "- A stronger response needs closer factual match (same dispute pattern, same procedural stage, and explicit treatment of asked provisions).\n\n"
        "### Suggested Filing-Focused Next Inputs\n"
        "1. Provide exact FIR sections and current stage (investigation/challan/trial).\n"
        "2. Provide timeline dates (FIR date, complaint history, related civil proceedings).\n"
        "3. Provide target relief wording you want drafted (quash FIR, stay coercive action, interim protection).\n\n"
        "### Next Best Step\n"
        "Please refine the query with specific facts (court, year range, statute/topic), or ingest additional relevant documents so I can provide a fully grounded legal answer."
    )


def is_procedural_query(query: str) -> bool:
    """Detect if query is asking for procedures, methods, or how-to guidance rather than specific case laws."""
    procedural_markers = [
        "procedure", "procedures", "process", "processes", "method", "methods",
        "how to", "how do", "how can", "how is", "how are", "how would",
        "steps", "step by step", "process of", "way to", "ways to",
        "requirements", "what is needed", "what do i need", "needed for",
        "stages", "practice", "practices", "filing", "filing a",
        "petition", "applications", "application process", "grounds for",
        "criteria", "criteria for", "conditions for", "norms", "norms for",
        "legal position", "approach", "approach to", "framework", "framework for",
        "doctrine", "principles", "principle of", "rule of", "rules of",
        "what are the", "types of", "kinds of", "categories of", "forms of",
    ]
    q_norm = normalize_text(query)
    return any(marker in q_norm for marker in procedural_markers)


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

    replaced_refs = answer.lower().count("the cited provision") + answer.lower().count("the cited constitutional provision")
    if replaced_refs >= 3:
        risk_signals += 2  # many hallucinated refs = strong signal
    elif replaced_refs >= 1:
        risk_signals += 1  # a few = weak signal

    answer_terms = set(_re.findall(r'[a-z]{4,}', answer.lower()))
    context_terms = set(_re.findall(r'[a-z]{4,}', retrieved_context.lower()))
    overlap = len(answer_terms & context_terms) / max(1, len(answer_terms))
    if overlap < 0.08:
        risk_signals += 2  # very low overlap = strong signal

    # Require at least 2 cumulative risk points to trigger fallback
    return risk_signals >= 2


# --------Node: verify_grounding----------

def verify_grounding(state: AgentState) -> AgentState:
    tool_outputs = []
    for msg in state.get("messages", []):
        if isinstance(msg, ToolMessage):
            tool_outputs.append(msg.content)

    if not tool_outputs:
        return {
            **state,
            "results_sufficient": False,
            "agent_trace": state.get("agent_trace", []) + [
                "🧪 Grounding verification failed: no tool outputs available."
            ],
        }

    combined = "\n\n".join(tool_outputs)
    query_lower = state.get("original_query", "").lower()
    requested_markers = extract_provision_markers(state.get("original_query", ""))
    # For judge_profile intent, the judge tool already handles court-specific retrieval
    # correctly. The LHC-only check below is only valid for case law queries where
    # our case corpus is LHC-only. Applying it to judge queries wrongly invalidates
    # correctly retrieved SC/IHC judge profiles.
    if state.get("query_intent") == "judge_profile":
        return {
            **state,
            "results_sufficient": True,
            "agent_trace": state.get("agent_trace", []) + [
                "🧪 Grounding: judge_profile intent — court-mismatch check skipped, trusting judge tool."
            ],
        }
    if requested_markers:
        ctx_lower = combined.lower()
        has_any_marker = any(m in ctx_lower for m in requested_markers)
        if not has_any_marker:
            return {
                **state,
                "results_sufficient": False,
                "agent_trace": state.get("agent_trace", []) + [
                    "🧪 Grounding verification: requested legal provision markers are missing in retrieved evidence."
                ],
            }

    return {
        **state,
        "results_sufficient": True,
        "agent_trace": state.get("agent_trace", []) + [
            "🧪 Grounding verification passed: evidence is sufficient for synthesis."
        ],
    }


# --------Node: synthesize_answer----------

def synthesize_answer(state: AgentState) -> AgentState:
    llm = llm_service.get_llm()

    # Use only the latest tool-output batch to avoid oversized prompts.
    messages = state["messages"]
    last_dispatch_idx = -1
    for i, msg in enumerate(messages):
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            last_dispatch_idx = i

    tool_outputs = []
    start_idx = last_dispatch_idx + 1 if last_dispatch_idx >= 0 else 0
    for msg in messages[start_idx:]:
        if isinstance(msg, ToolMessage):
            tool_outputs.append(msg.content)

    # Use raw tool output directly — the structured [Doc N of M] format produced
    # by _format_results is what the SYNTHESIZE_SYSTEM prompt expects. Context
    # compression was destroying that structure and garbling the LLM input.
    combined_context = "\n\n".join(tool_outputs)
    # llama-3.1-8b-instant: 20,000 TPM — much more room than 70b (6k TPM).
    # 6,000 chars ≈ 1,500 tokens for context, leaving ~3,500 tokens for prompt+output.
    max_context_chars = 6000
    if len(combined_context) > max_context_chars:
        combined_context = combined_context[:max_context_chars]

    doc_count = sum(1 for o in tool_outputs for line in o.split("\n") if line.startswith("[Doc "))

    conv_context = format_conversation_history(state.get("conversation_history", []))
    conv_section = f"\nPrior conversation:\n{conv_context}" if conv_context else ""

    query_intent = state.get("query_intent", "mixed")

    if query_intent == "conversational_followup":
        doc_section = ""
        prompt_instruction = "Answer the follow-up question naturally based strictly on the prior conversation."
    else:
        doc_section = f"--- RETRIEVED DOCUMENTS ({doc_count} total) ---\n{combined_context}\n\n"
        prompt_instruction = f"Answer now. Only create 🔷 cards for the {doc_count} retrieved documents above if applicable."

    synth_messages = [
        SystemMessage(content=SYNTHESIZE_SYSTEM),
        HumanMessage(
            content=(
                f"Intent: {query_intent}\n"
                f"Query: {state['original_query']}\n"
                f"{conv_section}\n"
                f"{doc_section}"
                f"{prompt_instruction}"
            )
        ),
    ]

    try:
        import time as _time
        _max_retries = 3
        _last_exc = None
        response = None
        for _attempt in range(_max_retries):
            try:
                response = llm.invoke(synth_messages)
                break  # success
            except Exception as _exc:
                _last_exc = _exc
                exc_str = str(_exc).lower()
                # Groq rate-limit (429) or server error (500/502): back off then retry
                if any(k in exc_str for k in ["rate", "429", "limit", "exceeded", "server error", "502", "503"]):
                    _wait = 2 ** _attempt  # 1s, 2s, 4s
                    print(f"[SYNTH] Groq rate-limit on attempt {_attempt+1}, retrying in {_wait}s...")
                    _time.sleep(_wait)
                    continue
                raise  # non-retriable error
        if response is None:
            raise _last_exc
        answer = sanitize_indian_law_references(response.content)
        answer = enforce_grounded_citations(answer, combined_context, state["original_query"])
    except Exception as exc:
        answer = build_conservative_fallback(state["original_query"], combined_context)
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
            **state,
            "final_answer": answer,
            "sources_summary": "\n".join(sources_lines[:15]),
            "messages": state["messages"] + [AIMessage(content=answer)],
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

    # For procedural/practice queries with retrieved documents: skip grounding checks
    is_procedural = is_procedural_query(state["original_query"])
    # Conversational follow-ups use conversation history, not retrieved docs — skip grounding.
    # Statutory law queries combine multiple tool results and discuss provisions — skip grounding.
    skip_grounding_check = is_judge_query or is_followup or is_statutory or (is_procedural and doc_count > 0)

    if not skip_grounding_check and (low_evidence or has_grounding_risk(answer, combined_context)):
        answer = build_conservative_fallback(state["original_query"], combined_context)
        trace_suffix = " (conservative fallback due to weak grounding/evidence)"
    else:
        trace_suffix = ""

    sources_lines = []
    for output in tool_outputs:
        for line in output.split("\n"):
            if line.startswith("[Doc"):
                sources_lines.append(line.strip())

    sources_summary = "\n".join(sources_lines[:15])

    trace_msg = f"✍️  Synthesizing final answer ({len(answer)} chars) from {len(tool_outputs)} tool result(s){trace_suffix}"

    return {
        **state,
        "final_answer": answer,
        "sources_summary": sources_summary,
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + [trace_msg],
    }


# --------Node: respond_out_of_scope-------------

def respond_out_of_scope(state: AgentState) -> AgentState:
    answer = (
        "I'm Wakeels AI, your legal research assistant. I specialize in Pakistani law, especially Supreme Court and Islamabad High Court cases, judgments, and judge profiles.\n\n"
        "Your question appears to be outside my scope or not related to the legal data I have.\n"
        "Please ask me about Pakistani legal matters, SC/IHC cases, legal procedures, or judge profiles.\n"
        "I cannot answer questions unrelated to law, but I'm happy to help with any legal research!"
    )
    return {
        **state,
        "final_answer": answer,
        "sources_summary": "",
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + ["⛔ Query is out of scope for Pakistani law."],
    }


# --------Node: respond_greeting-------------

def respond_greeting(state: AgentState) -> AgentState:
    query = state.get("original_query", "")
    q = normalize_text(query)
    if "who are you" in q or "what is your name" in q:
        answer = (
            "I'm Wakeels AI, your Pakistani legal research assistant. "
            "I help with Supreme Court, High Courts, and Federal/Punjab laws, including cases, provisions, and judge profiles. "
            "Ask any legal query and I will guide you with relevant citations."
        )
    else:
        answer = (
            "Hello. I am Wakeels AI, built for Pakistani legal research. "
            "I can help you with case-law analysis, statute/provision queries, legal drafting guidance, and judge profiles. "
            "Please share your legal question."
        )

    return {
        **state,
        "final_answer": answer,
        "sources_summary": "",
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + ["👋 Conversational intent detected: responded instantly without vector search or LLM call."],
    }


# --------Node: respond_insufficient_data-------------

def respond_insufficient_data(state: AgentState) -> AgentState:
    tool_outputs = []
    for msg in state.get("messages", []):
        if isinstance(msg, ToolMessage):
            tool_outputs.append(msg.content)
    combined = "\n\n".join(tool_outputs)
    answer = build_conservative_fallback(state.get("original_query", ""), combined)

    src_lines = []
    for output in tool_outputs:
        for line in output.split("\n"):
            if line.startswith("[Doc"):
                src_lines.append(line.strip())

    return {
        **state,
        "final_answer": answer,
        "sources_summary": "\n".join(src_lines[:15]),
        "messages": state["messages"] + [AIMessage(content=answer)],
        "agent_trace": state.get("agent_trace", []) + [
            "🛑 Retrieval stayed weak after retries — returned conservative grounded response."
        ],
    }


# Router: route_after_understand
def route_after_understand(state: AgentState) -> Literal["dispatch_search", "respond_out_of_scope", "respond_greeting", "synthesize_answer"]:
    intent = state.get("query_intent", "case_law")
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
) -> Literal["verify_grounding", "refine_and_retry", "respond_insufficient_data"]:
    if state.get("results_sufficient", False):
        return "verify_grounding"
    if state.get("retry_count", 0) >= 3:
        return "respond_insufficient_data"
    return "refine_and_retry"


# Router: route_after_verify
def route_after_verify(
    state: AgentState,
) -> Literal["synthesize_answer", "refine_and_retry", "respond_insufficient_data"]:
    if state.get("results_sufficient", False):
        return "synthesize_answer"
    if state.get("retry_count", 0) >= 3:
        return "respond_insufficient_data"
    return "refine_and_retry"


# Router: should_continue_after_retry
def should_continue_after_retry(
    state: AgentState,
) -> Literal["call_tools", "synthesize_answer"]:
    last = state["messages"][-1] if state["messages"] else None
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return "call_tools"
    return "synthesize_answer"


class NodesService:
    def understand_query(self, state: AgentState) -> AgentState:
        return understand_query(state)

    def dispatch_search(self, state: AgentState) -> AgentState:
        return dispatch_search(state)

    def evaluate_results(self, state: AgentState) -> AgentState:
        return evaluate_results(state)

    def verify_grounding(self, state: AgentState) -> AgentState:
        return verify_grounding(state)

    def refine_and_retry(self, state: AgentState) -> AgentState:
        return refine_and_retry(state)

    def synthesize_answer(self, state: AgentState) -> AgentState:
        return synthesize_answer(state)

    def respond_out_of_scope(self, state: AgentState) -> AgentState:
        return respond_out_of_scope(state)

    def respond_greeting(self, state: AgentState) -> AgentState:
        return respond_greeting(state)

    def respond_insufficient_data(self, state: AgentState) -> AgentState:
        return respond_insufficient_data(state)

    def route_after_understand(self, state: AgentState) -> Literal["dispatch_search", "respond_out_of_scope", "respond_greeting", "synthesize_answer"]:
        return route_after_understand(state)

    def route_after_evaluate(self, state: AgentState) -> Literal["verify_grounding", "refine_and_retry", "respond_insufficient_data"]:
        return route_after_evaluate(state)

    def route_after_verify(self, state: AgentState) -> Literal["synthesize_answer", "refine_and_retry", "respond_insufficient_data"]:
        return route_after_verify(state)

    def should_continue_after_retry(self, state: AgentState) -> Literal["call_tools", "synthesize_answer"]:
        return should_continue_after_retry(state)


nodes_service = NodesService()
