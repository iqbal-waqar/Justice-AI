"""Structure-aware, token-sized text splitting used by the ingestion pipeline.

Chunk assembly (headers, metadata, judge profiles) lives in backend.services.ingestion.
"""
from langchain.text_splitter import RecursiveCharacterTextSplitter
import tiktoken

CHUNK_SIZE = 1024
CHUNK_OVERLAP = 128


class ChunkingService:
    def __init__(self):
        self.encoder = tiktoken.get_encoding("cl100k_base")

    def get_token_length(self, text: str) -> int:
        return len(self.encoder.encode(text))

    def get_text_splitter(self) -> RecursiveCharacterTextSplitter:
        return RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=self.get_token_length,
            separators=[
                r"\n(?=\s*CHAPTER\s)",
                r"\n(?=\s*PART\s)",
                r"\n(?=\s*Article\s+\d)",
                r"\n(?=\s*Section\s+\d)",
                r"\n(?=\s*\d{1,3}[.\)]\s)",
                "\n\n",
                "\n",
                "(?<=[.!?]) ",
                " ",
                "",
            ],
            is_separator_regex=True,
        )


chunking_service = ChunkingService()

