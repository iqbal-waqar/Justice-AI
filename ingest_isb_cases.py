"""Ingest Islamabad High Court cases. Thin shim over the unified ingestion pipeline."""
import warnings
warnings.filterwarnings("ignore")

from dotenv import load_dotenv
load_dotenv()

from backend.services.ingestion import ingestion_service

FILE_PATH = "data/isb_data/isb_cases_rebuilt.jsonl"
DOC_TYPE = "isb_case"

if __name__ == "__main__":
    total = sum(1 for _ in open(FILE_PATH, "r", encoding="utf-8"))
    print(f"🚀 Ingesting {total} ISB cases as doc_type='{DOC_TYPE}'")
    result = ingestion_service.ingest_file(
        file_path=FILE_PATH, doc_type=DOC_TYPE, batch_size=64, clean=True, total_records=total,
    )
    print("\n=== Ingestion Complete ===")
    for k, v in result.items():
        print(f"{k}: {v}")
