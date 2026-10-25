import re
from typing import Any, Dict, Generator, List, Optional

from backend.services.graph import graph_service
from backend.services.nodes import AgentState


class AgentService:
    def _initial_state(self, query, conversation_history, filters) -> AgentState:
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
                        "sc_case", "lhc_case", "isb_case", "federal_law", "punjab_law",
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

        # Judge-profile name filtering (keep only sources matching the asked name)
        query_intent = final_state.get("query_intent", "mixed")
        if query_intent == "judge_profile" and sources:
            query_lower = query.lower()
            name_tokens = []
            jm = re.search(r'(?:justice|judge)\s+((?:[a-z]+(?:\s+|$)){1,5})', query_lower)
            if jm:
                raw_name = jm.group(1).strip()
                non_name_tail = {
                    "of", "the", "and", "or", "in", "at", "for", "from", "to",
                    "is", "are", "was", "were", "as", "lahore", "high", "court",
                    "supreme", "islamabad", "pakistan", "punjab", "elevated",
                    "appointed", "born", "judge", "chief", "sitting", "former",
                    "senior", "most", "current", "retired",
                }
                clean = []
                for p in raw_name.split():
                    if p in non_name_tail:
                        break
                    clean.append(p)
                name_tokens = [t for t in clean if len(t) > 1]

            if name_tokens:
                filtered = []
                for s in sources:
                    title_lower = s.get("title", "").lower()
                    if all(token in title_lower for token in name_tokens):
                        filtered.append(s)
                if filtered:
                    sources = filtered
                else:
                    answer_lower = final_state.get("final_answer", "").lower()
                    if (
                        ("not found" in answer_lower and answer_lower.count("not found") >= 3)
                        or "don't have this judge" in answer_lower
                        or "couldn't find" in answer_lower
                    ):
                        sources = []

        return sources[:10]

    def _print_trace(self, final_state: Dict[str, Any], query: str):
        print(f"\n{'='*70}\n🤖 WAKEELS AI AGENT\n   Query: {query[:120]}\n{'='*70}")
        for step in final_state.get("agent_trace", []):
            print(f"  {step}")
        print(f"{'='*70}\n")

    def run_agent(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        filters: Optional[dict] = None,
    ) -> Dict[str, Any]:
        agent = graph_service.get_agent()
        initial_state = self._initial_state(query, conversation_history, filters)
        final_state = agent.invoke(initial_state)
        self._print_trace(final_state, query)
        return {
            "answer": final_state.get("final_answer", "Unable to generate an answer."),
            "sources": self._extract_sources(final_state, query),
            "agent_trace": final_state.get("agent_trace", []),
            "query": query,
        }

    def stream_agent(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        filters: Optional[dict] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream the pipeline: emits {'type': 'token'|'final'|'sources'|'done'}.

        Tokens come from the LLM in the synthesize_answer node as they generate.
        The 'final' event carries the authoritative (sanitized/fallback/greeting)
        answer which the client uses to replace the streamed text.
        """
        agent = graph_service.get_agent()
        initial_state = self._initial_state(query, conversation_history, filters)

        # Friendly status shown AFTER each node completes (signals the next phase).
        next_status = {
            "understand_query": "📚 Searching Pakistani case law…",
            "dispatch_search": "📚 Searching Pakistani case law…",
            "call_tools": "🧠 Reviewing the best matches…",
            "evaluate_results": "✍️ Writing the answer…",
            "verify_grounding": "✍️ Writing the answer…",
            "refine_and_retry": "📚 Searching again…",
        }

        yield {"type": "status", "content": "🔎 Understanding your question…"}

        last_values: Dict[str, Any] = {}
        for mode, data in agent.stream(initial_state, stream_mode=["messages", "updates", "values"]):
            if mode == "messages":
                chunk, meta = data
                if meta.get("langgraph_node") == "synthesize_answer":
                    text = getattr(chunk, "content", "") or ""
                    if text:
                        yield {"type": "token", "content": text}
            elif mode == "updates":
                for node in (data or {}):
                    status = next_status.get(node)
                    if status:
                        yield {"type": "status", "content": status}
            elif mode == "values":
                last_values = data

        self._print_trace(last_values, query)
        yield {"type": "final", "content": last_values.get("final_answer", "")}
        yield {"type": "sources", "sources": self._extract_sources(last_values, query)}
        yield {"type": "done"}


agent_service = AgentService()
