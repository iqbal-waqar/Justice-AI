"""Ingest Federal Laws of Pakistan. Thin shim over the unified ingestion pipeline."""
import warnings
warnings.filterwarnings("ignore")

from dotenv import load_dotenv
load_dotenv()

from backend.services.ingestion import ingestion_service

FILE_PATH = "data/federal_laws/federal_laws_index.jsonl"
DOC_TYPE = "federal_law"

if __name__ == "__main__":
    total = sum(1 for _ in open(FILE_PATH, "r", encoding="utf-8"))
    print(f"Total federal laws to ingest: {total}")

    def progress(cur, tot, status):
        print(f"\r[{cur}/{tot}] {status}...", end="")

    result = ingestion_service.ingest_file(
        file_path=FILE_PATH, doc_type=DOC_TYPE, batch_size=64, clean=True,
        progress_callback=progress, total_records=total,
    )
    print("\n\n=== Ingestion Complete ===")
    for k, v in result.items():
        print(f"{k}: {v}")
