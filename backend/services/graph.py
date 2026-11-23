from typing import Any

from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode

from backend.services.tools import ALL_TOOLS, tool_error_message
from backend.services import nodes
from backend.services.nodes import AgentState


class GraphService:
    def __init__(self):
        self.agent_graph = None

    def build_agent_graph(self) -> Any:
        # A failing search is reported as such (see evaluate_results), never as "no results".
        tool_node = ToolNode(ALL_TOOLS, handle_tool_errors=tool_error_message)

        graph = StateGraph(AgentState)

        graph.add_node("understand_query", nodes.understand_query)
        graph.add_node("dispatch_search", nodes.dispatch_search)
        graph.add_node("call_tools", tool_node)
        graph.add_node("evaluate_results", nodes.evaluate_results)
        graph.add_node("verify_grounding", nodes.verify_grounding)
        graph.add_node("refine_and_retry", nodes.refine_and_retry)
        graph.add_node("assess_relevance", nodes.assess_relevance)
        graph.add_node("respond_not_covered", nodes.respond_not_covered)
        graph.add_node("synthesize_answer", nodes.synthesize_answer)
        graph.add_node("verify_answer", nodes.verify_answer)
        graph.add_node("respond_out_of_scope", nodes.respond_out_of_scope)
        graph.add_node("respond_greeting", nodes.respond_greeting)
        graph.add_node("respond_insufficient_data", nodes.respond_insufficient_data)
        graph.add_node("respond_search_unavailable", nodes.respond_search_unavailable)
        graph.add_node("respond_clarify", nodes.respond_clarify)

        graph.add_edge(START, "understand_query")

        graph.add_conditional_edges(
            "understand_query",
            nodes.route_after_understand,
            {
                "dispatch_search": "dispatch_search",
                "respond_out_of_scope": "respond_out_of_scope",
                "respond_greeting": "respond_greeting",
                "respond_clarify": "respond_clarify",
                "synthesize_answer": "synthesize_answer",
            },
        )

        graph.add_edge("dispatch_search", "call_tools")
        graph.add_edge("call_tools", "evaluate_results")

        graph.add_conditional_edges(
            "evaluate_results",
            nodes.route_after_evaluate,
            {
                "verify_grounding": "verify_grounding",
                "refine_and_retry": "refine_and_retry",
                "respond_insufficient_data": "respond_insufficient_data",
                "respond_search_unavailable": "respond_search_unavailable",
            },
        )

        graph.add_conditional_edges(
            "verify_grounding",
            nodes.route_after_verify,
            {"assess_relevance": "assess_relevance", "refine_and_retry": "refine_and_retry"},
        )

        graph.add_conditional_edges(
            "assess_relevance",
            nodes.route_after_assess,
            {
                "synthesize_answer": "synthesize_answer",
                "respond_not_covered": "respond_not_covered",
            },
        )
        graph.add_edge("respond_not_covered", END)

        graph.add_edge("refine_and_retry", "call_tools")

        # Every written answer is checked against its sources before it is returned.
        graph.add_edge("synthesize_answer", "verify_answer")
        graph.add_edge("verify_answer", END)
        graph.add_edge("respond_out_of_scope", END)
        graph.add_edge("respond_greeting", END)
        graph.add_edge("respond_insufficient_data", END)
        graph.add_edge("respond_search_unavailable", END)
        graph.add_edge("respond_clarify", END)

        return graph.compile()

    def get_agent(self) -> Any:
        """Return singleton compiled agent graph."""
        if self.agent_graph is None:
            self.agent_graph = self.build_agent_graph()
            print("✅ Justice AI Agent graph compiled and ready.")
        return self.agent_graph


graph_service = GraphService()
