from typing import Any, Dict, Generator, List, Optional

from langchain_core.messages import AIMessageChunk

from backend.services.graph import graph_service
from backend.services.nodes import AgentState
from backend.services.tracing import run_config


class AgentService:
    def _initial_state(self, query, conversation_history, filters, language: str = "auto") -> AgentState:
        return {
            "messages": [],
            "original_query": query,
            "search_query": "",
            "query_intent": "",
            "retry_count": 0,
            "results_sufficient": False,
            "final_answer": "",
            "sources_summary": "",
            "conversation_history": conversation_history or [],
            "filters": filters or {},
            "agent_trace": [],
            "corrections": [],
            "answerable": True,
            "relevant_doc_ids": None,
            "assessment_reason": "",
            "assessment_verdict": "",
            "search_years": None,
            "language_preference": language or "auto",
            "answer_language": "en",            # decided in understand_query
            "english_query": query,
            "restate_previous": False,
            "search_doc_types": None,
            "multi_part": False,
            "targeted_case": False,
            "judge_args": None,
            "search_failed": False,
            "answer_contexts": [],
            "answer_corrections": [],
            "interpretation": None,
            "clarification": None,
        }

    def _extract_sources(self, final_state: Dict[str, Any], query: str) -> List[Dict[str, Any]]:
        """Parse + dedupe sources from the agent's sources_summary (shared by
        the blocking and streaming paths)."""
        sources = []
        seen_source_keys = set()
        for line in final_state.get("sources_summary", "").split("\n"):
            line = line.strip()
            if not line or not line.startswith("[Doc"):
                continue

            parts = line.split("|")
            source = {}
            for part in parts:
                part = part.strip()
                if part.startswith("[Doc"):
                    title = part.split("]", 1)[-1].strip() if "]" in part else part
                    source["title"] = title
                elif part.startswith("score="):
                    try:
                        source["score"] = float(part.replace("score=", ""))
                    except Exception:
                        pass
                elif part.startswith("pdf_url="):
                    url = part.replace("pdf_url=", "").strip()
                    if url and url != "None":
                        source["pdf_url"] = url
                elif part.startswith("image_url="):
                    url = part.replace("image_url=", "").strip()
                    if url and url != "None":
                        source["image_url"] = url
                elif part.startswith("judge_name="):
                    name = part.replace("judge_name=", "").strip()
                    if name and name != "None":
                        source["judge_name"] = name
                else:
                    stripped = part.strip()
                    known_doc_types = [
                        "sc_case", "lhc_case", "isb_case", "district_case", "federal_law", "punjab_law", "court_rules",
                        "sc_judge", "lhc_judge", "isb_judge",
                    ]
                    if stripped in known_doc_types:
                        source["doc_type"] = stripped
                    else:
                        for court in [
                            "Supreme Court of Pakistan",
                            "Lahore High Court",
                            "Islamabad High Court",
                            "Federal Legislature",
                            "Punjab Legislature",
                            "Lahore High Court (District)",
                        ]:
                            if court.lower() in stripped.lower():
                                source["court"] = court
                                break
                        else:
                            if stripped.endswith("District Courts"):
                                source["court"] = stripped
                        if len(stripped) == 4 and stripped.isdigit():
                            source["year"] = stripped

            title_key = (source.get("title") or "").strip().lower()
            source_key = "|".join([
                title_key,
                (source.get("doc_type") or "").strip().lower(),
                (source.get("court") or "").strip().lower(),
                (source.get("year") or "").strip().lower(),
                (source.get("pdf_url") or "").strip().lower(),
            ])

            if source and source_key not in seen_source_keys:
                seen_source_keys.add(source_key)
                sources.append(source)

        return sources[:10]

    # ── Live status: describe what each graph node ACTUALLY did ─────────────
    _SCOPE_LABELS = {
        "sc_case": "Supreme Court",
        "isb_case": "Islamabad High Court",
        "lhc_case": "Lahore High Court",
        "district_case": "district courts",
        "federal_law": "federal statutes",
        "punjab_law": "Punjab laws",
        "court_rules": "LHC Rules & Orders",
    }

    _JUDGE_COURT_LABELS = {
        "supreme_court": "Supreme Court",
        "lahore_high_court": "Lahore High Court",
        "islamabad_high_court": "Islamabad High Court",
    }

    def _search_scope(self, doc_types) -> str:
        from backend.services.tools import _CASE_DOC_TYPES_ALL
        if not doc_types or set(doc_types) >= set(_CASE_DOC_TYPES_ALL):
            return "all courts & statutes"
        labels = [self._SCOPE_LABELS[d] for d in doc_types if d in self._SCOPE_LABELS]
        if len(labels) <= 1:
            return labels[0] if labels else "all courts"
        return ", ".join(labels[:-1]) + " & " + labels[-1]

    def _describe_tool_call(self, call: Dict[str, Any], intent: str) -> str:
        name = call.get("name", "")
        args = call.get("args", {}) or {}
        q = args.get("query") or args.get("topic") or ""
        if name == "search_judge_profiles":
            courts = [self._JUDGE_COURT_LABELS[c] for c in (args.get("courts") or []) if c in self._JUDGE_COURT_LABELS]
            where = " & ".join(courts) if courts else "SC, IHC & LHC"
            return f"👨‍⚖️ Searching judge profiles ({where})…"
        years = args.get("years") or []
        when = ""
        if years:
            when = f" decided in {years[0]}" if len(years) == 1 else f" decided {years[0]}–{years[-1]}"
        if name == "retrieve_with_full_pipeline" and intent == "statutory_law":
            return f"📜 Searching statutes & provisions — {self._search_scope(args.get('doc_types'))}{when}…"
        if name in ("retrieve_with_full_pipeline", "search_case_law"):
            return f"⚖️ Searching case law — {self._search_scope(args.get('doc_types'))}{when}…"
        return "📚 Searching the legal database…"

    def _describe_step(self, node: str, delta: Dict[str, Any], ctx: Dict[str, Any]) -> Optional[str]:
        if node == "understand_query":
            intent = delta.get("query_intent", "")
            ctx["intent"] = intent
            trace = delta.get("agent_trace", []) or []
            if intent in ("greeting", "out_of_scope"):
                return "💬 Replying…"
            if intent == "clarify":
                return "❓ The reference is unclear — asking you to confirm…"
            if intent == "conversational_followup":
                if delta.get("restate_previous"):
                    return "🗣️ Rewriting the previous answer in the language you asked for…"
                return "💬 Re-reading our conversation to answer your follow-up…"
            if delta.get("targeted_case"):
                ctx["targeted"] = True
                return f"🎯 Pulling the full judgment: {delta.get('search_query', '')[:80]}…"
            if any(t.startswith("🔗") for t in trace):
                return "🔗 Linking your follow-up to the earlier discussion…"
            if any(t.startswith("🌐") for t in trace):
                return "🌐 Understood your question — searching the English case law…"
            return None

        if node in ("dispatch_search", "refine_and_retry"):
            msgs = delta.get("messages", []) or []
            calls = getattr(msgs[-1], "tool_calls", None) if msgs else None
            if not calls:
                return None
            if node == "refine_and_retry":
                return f"🔁 Results were weak — searching again with {len(calls)} rephrased quer{'y' if len(calls) == 1 else 'ies'}…"
            if ctx.get("targeted"):
                return None  # already announced as "Pulling the full judgment"
            return self._describe_tool_call(calls[0], ctx.get("intent", ""))

        if node == "call_tools":
            outputs = [getattr(m, "content", "") or "" for m in (delta.get("messages", []) or [])]
            combined = "\n".join(outputs)
            n_docs = combined.count("[Doc ")
            if n_docs == 0:
                if "SEARCH_UNAVAILABLE" in combined:
                    return None  # evaluate_results announces the outage
                return "⚠️ No strong matches found…"
            kind = "judge profile" if ctx.get("intent") == "judge_profile" else "document"
            return f"🧠 Found {n_docs} relevant {kind}{'' if n_docs == 1 else 's'} — reviewing them…"

        if node == "evaluate_results":
            if delta.get("search_failed"):
                return "⚠️ The legal database could not be reached…"
            if delta.get("results_sufficient"):
                return "🧪 Checking the evidence supports an answer…"
            return None  # refine_and_retry announces the retry itself

        if node == "verify_grounding":
            if delta.get("results_sufficient"):
                return "🧪 Checking the documents actually answer your question…"
            return "🔍 Asked provision not found in results — looking further…"

        if node == "assess_relevance":
            if delta.get("answerable", True):
                ids = delta.get("relevant_doc_ids")
                n = len(ids) if ids else None
                return f"✍️ Writing the answer from {n} relevant document{'s' if n != 1 else ''}…" if n else "✍️ Writing the answer with citations…"
            return "⚠️ Nothing on point found — writing an honest reply…"

        if node == "synthesize_answer" and (delta.get("answer_contexts") or []):
            return "🔍 Double-checking every statement against the sources…"

        if node == "verify_answer":
            fixes = delta.get("answer_corrections") or []
            if fixes:
                return f"✏️ Corrected {len(fixes)} statement{'s' if len(fixes) != 1 else ''} to match the sources exactly."
            return None

        if node == "respond_insufficient_data":
            return "⚠️ Couldn't find strong authority — preparing a careful response…"

        return None

    def _print_trace(self, final_state: Dict[str, Any], query: str):
        print(f"\n{'='*70}\n🤖 JUSTICE AI AGENT\n   Query: {query[:120]}\n{'='*70}")
        for step in final_state.get("agent_trace", []):
            print(f"  {step}")
        print(f"{'='*70}\n")

    def stream_agent(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        filters: Optional[dict] = None,
        language: str = "auto",
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream the pipeline: emits {'type': 'token'|'final'|'sources'|'done'}.

        Tokens come from the LLM in the synthesize_answer node as they generate.
        The 'final' event carries the authoritative (sanitized/fallback/greeting)
        answer which the client uses to replace the streamed text.
        """
        agent = graph_service.get_agent()
        initial_state = self._initial_state(query, conversation_history, filters, language)

        yield {"type": "status", "content": "🔎 Understanding your question…"}

        last_values: Dict[str, Any] = {}
        streamed_tokens = False
        ctx: Dict[str, Any] = {}
        for mode, data in agent.stream(initial_state, config=run_config(query, conversation_history, "stream"),
                                       stream_mode=["messages", "updates", "values"]):
            if mode == "messages":
                chunk, meta = data
                # Only live model chunks are tokens. LangGraph also emits each finished
                # message a node returns; forwarding that would print the answer twice.
                if isinstance(chunk, AIMessageChunk) and meta.get("langgraph_node") in (
                        "synthesize_answer", "respond_greeting", "respond_out_of_scope"):
                    text = getattr(chunk, "content", "") or ""
                    if text:
                        streamed_tokens = True
                        yield {"type": "token", "content": text}
            elif mode == "updates":
                for node, delta in (data or {}).items():
                    status = self._describe_step(node, delta or {}, ctx)
                    if status:
                        yield {"type": "status", "content": status}
            elif mode == "values":
                last_values = data

        self._print_trace(last_values, query)

        # Canned answers (greetings, out-of-scope, fallbacks) never pass through
        # the LLM, so no tokens were streamed above. Stream them word-by-word
        # here so the client gets the same typewriter effect for every response.
        final_answer = last_values.get("final_answer", "")
        if not streamed_tokens and final_answer:
            import time as _time
            words = final_answer.split(" ")
            chunk_size = 3
            for i in range(0, len(words), chunk_size):
                piece = " ".join(words[i:i + chunk_size])
                if i + chunk_size < len(words):
                    piece += " "
                yield {"type": "token", "content": piece}
                _time.sleep(0.02)

        yield {"type": "final", "content": final_answer}
        yield {"type": "sources", "sources": self._extract_sources(last_values, query)}
        yield {"type": "done"}


agent_service = AgentService()
