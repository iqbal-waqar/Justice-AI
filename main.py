from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from backend.routes.chat import router as chat_router
from backend.routes.ingest import router as ingest_router
from backend.routes.health import router as health_router
from backend.routes.auth import router as auth_router
from backend.routes.hearings import router as hearings_router
from backend.routes.documents import router as documents_router
from backend.routes.chat_sessions import router as chat_sessions_router
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Wakeels AI",
    description="AI-powered Pakistani Legal Research Assistant",
    version="1.0.0",
)

@app.on_event("startup")
async def startup_event():
    print("🚀 Pre-loading AI models (Embeddings & Reranker)...")
    from backend.services.embeddings import embeddings_service
    from backend.services.tools import _get_reranker
    embeddings_service.get_embeddings()
    _get_reranker()
    print("✅ All models loaded and ready.")

    # Start background scheduler for hearing reminders
    from apscheduler.schedulers.background import BackgroundScheduler
    from backend.services.scheduler import scheduler_service

    scheduler = BackgroundScheduler()
    # Run every 6 hours (checks for hearings 1-2 days away; reminder_sent flag dedupes)
    _interval_hours = int(os.getenv("HEARING_CHECK_INTERVAL_HOURS", "6"))
    scheduler.add_job(scheduler_service.check_upcoming_hearings, "interval", hours=_interval_hours, id="hearing_reminders")
    # Also run once on startup (after 30 seconds delay)
    scheduler.add_job(scheduler_service.check_upcoming_hearings, "date", id="hearing_reminders_startup",
                      run_date=None)  # runs immediately
    scheduler.start()
    print("📧 Hearing reminder scheduler started (runs every 6 hours)")

@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully close Qdrant connection on shutdown."""
    from backend.services.qdrant import qdrant_service
    qdrant_service.close_qdrant_client()
    print("🔌 Qdrant connection closed.")

# Restrict CORS to known frontend origins (override via ALLOWED_ORIGINS in .env,
# comma-separated). "*" with credentials is invalid per the CORS spec anyway.
_allowed = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
)
_origins = [o.strip() for o in _allowed.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(auth_router, prefix="/api/v1", tags=["Auth"])
app.include_router(hearings_router, prefix="/api/v1", tags=["Hearings"])
app.include_router(documents_router, prefix="/api/v1", tags=["Documents"])
app.include_router(chat_sessions_router, prefix="/api/v1", tags=["Chat Sessions"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(ingest_router, prefix="/api/v1", tags=["Ingestion"])

# Serve data directory for local images/PDFs
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
if os.path.exists(DATA_DIR):
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
    print(f"📂 Data directory mounted at /data")


@app.get("/")
async def root():
    return {
        "message": "Welcome to Wakeels AI - Pakistani Legal Research Assistant",
        "docs": "/docs",
        "version": "1.0.0",
    }