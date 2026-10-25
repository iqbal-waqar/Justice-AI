"""
Prompts Service - Shared prompt utilities for Wakeels AI

Note: Main synthesis/refine prompts are defined inline in agent.py.
This module provides conversation history formatting used by the agent.
"""


def format_conversation_history(history: list) -> str:
    """Format conversation history for inclusion in prompt."""
    if not history:
        return ""

    formatted = ["## Previous Conversation:"]
    for msg in history[-12:]:  # Last 6 turns (12 messages)
        role = msg.get("role", "user").capitalize()
        content = msg.get("content", "")
        # Keep model answers longer — they contain the retrieved case data
        # that follow-up queries need to reference.
        max_len = 2500 if role.lower() == "model" else 500
        content = content[:max_len]
        formatted.append(f"{role}: {content}")

    return "\n".join(formatted)