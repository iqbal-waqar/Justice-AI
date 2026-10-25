from typing import Any

from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode

from backend.services.tools import ALL_TOOLS
from backend.services.nodes import (
    AgentState,
    nodes_service,
)


class GraphService:
    def __init__(self):
        self.agent_graph = None

    def build_agent_graph(self) -> Any:
        tool_node = ToolNode(ALL_TOOLS)

        graph = StateGraph(AgentState)

        graph.add_node("understand_query", nodes_service.understand_query)
        graph.add_node("dispatch_search", nodes_service.dispatch_search)
        graph.add_node("call_tools", tool_node)
        graph.add_node("evaluate_results", nodes_service.evaluate_results)
        graph.add_node("verify_grounding", nodes_service.verify_grounding)
        graph.add_node("refine_and_retry", nodes_service.refine_and_retry)
        graph.add_node("synthesize_answer", nodes_service.synthesize_answer)
        graph.add_node("respond_out_of_scope", nodes_service.respond_out_of_scope)
        graph.add_node("respond_greeting", nodes_service.respond_greeting)
        graph.add_node("respond_insufficient_data", nodes_service.respond_insufficient_data)

        graph.add_edge(START, "understand_query")

        graph.add_conditional_edges(
            "understand_query",
            nodes_service.route_after_understand,
            {
                "dispatch_search": "dispatch_search",
                "respond_out_of_scope": "respond_out_of_scope",
                "respond_greeting": "respond_greeting",
                "synthesize_answer": "synthesize_answer",
            },
        )

        graph.add_edge("dispatch_search", "call_tools")
        graph.add_edge("call_tools", "evaluate_results")

        graph.add_conditional_edges(
            "evaluate_results",
            nodes_service.route_after_evaluate,
            {
                "verify_grounding": "verify_grounding",
                "refine_and_retry": "refine_and_retry",
                "respond_insufficient_data": "respond_insufficient_data",
            },
        )

        graph.add_conditional_edges(
            "verify_grounding",
            nodes_service.route_after_verify,
            {
                "synthesize_answer": "synthesize_answer",
                "refine_and_retry": "refine_and_retry",
                "respond_insufficient_data": "respond_insufficient_data",
            },
        )

        graph.add_conditional_edges(
            "refine_and_retry",
            nodes_service.should_continue_after_retry,
            {"call_tools": "call_tools", "synthesize_answer": "synthesize_answer"},
        )

        graph.add_edge("synthesize_answer", END)
        graph.add_edge("respond_out_of_scope", END)
        graph.add_edge("respond_greeting", END)
        graph.add_edge("respond_insufficient_data", END)

        return graph.compile()

    def get_agent(self) -> Any:
        """Return singleton compiled agent graph."""
        if self.agent_graph is None:
            self.agent_graph = self.build_agent_graph()
            print("✅ Wakeels AI Agent graph compiled and ready.")
        return self.agent_graph


graph_service = GraphService()


def build_agent_graph() -> Any:
    return graph_service.build_agent_graph()


def get_agent() -> Any:
    return graph_service.get_agent()
