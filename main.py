from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Start the local Redis server (answer cache) before anything connects to it.
from backend.services.redis_server import ensure_redis_running
ensure_redis_running()

from backend.routes.chat import router as chat_router
from backend.routes.ingest import router as ingest_router
from backend.routes.health import router as health_router
from backend.routes.auth import router as auth_router
from backend.routes.hearings import router as hearings_router
from backend.routes.documents import router as documents_router
from backend.routes.chat_sessions import router as chat_sessions_router
from backend.routes.notes import router as notes_router
from backend.routes.voice import router as voice_router
from backend.routes.firm import router as firm_router
from backend.routes.clients import router as clients_router
from backend.routes.vault import router as vault_router
from backend.routes.billing import router as billing_router
from backend.routes.library import router as library_router
from backend.routes.portal import router as portal_router
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Justice AI",
    description="AI-powered Pakistani Legal Research Assistant",
    version="1.0.0",
)

@app.on_event("startup")
async def startup_event():
    # Warm what every query uses, so the first chat request doesn't pay setup costs:
    # Qdrant connection, the BM25 sparse model, the Voyage client, the compiled graph.
    # (The local cross-encoder is a fallback only and now loads lazily on first use.)
    print("🚀 Warming up retrieval services...")
    from backend.services.embeddings import embeddings_service
    from backend.services.sparse import sparse_service
    from backend.services.qdrant import qdrant_service
    from backend.services.graph import graph_service
    embeddings_service.get_embeddings()
    sparse_service.embed_query("warm up")
    qdrant_service.get_qdrant_client()
    graph_service.get_agent()
    from backend.services.llm import llm_service
    llm_service.warm_up()  # open the OpenAI connections now, not on the first question
    print("✅ Retrieval services ready.")

    from backend.database.db import SessionLocal
    from backend.interactors.library_interactor import library_interactor
    with SessionLocal() as db:
        added = library_interactor.seed_system_resources(db)
    if added:
        print(f"📚 Law library: added {added} built-in resource(s)")
    from backend.services.tracing import log_tracing_status
    log_tracing_status()

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
app.include_router(notes_router, prefix="/api/v1", tags=["Case Notes"])
app.include_router(documents_router, prefix="/api/v1", tags=["Documents"])
app.include_router(chat_sessions_router, prefix="/api/v1", tags=["Chat Sessions"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(voice_router, prefix="/api/v1", tags=["Voice"])
app.include_router(firm_router, prefix="/api/v1", tags=["Firm & Team"])
app.include_router(clients_router, prefix="/api/v1", tags=["Clients & Cases"])
app.include_router(vault_router, prefix="/api/v1", tags=["Document Vault"])
app.include_router(billing_router, prefix="/api/v1", tags=["Billing"])
app.include_router(library_router, prefix="/api/v1", tags=["Law Library"])
app.include_router(portal_router, prefix="/api/v1", tags=["Client Portal & Directory"])
app.include_router(ingest_router, prefix="/api/v1", tags=["Ingestion"])

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
if os.path.exists(DATA_DIR):
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
    print(f"📂 Data directory mounted at /data")


@app.get("/")
async def root():
    return {
        "message": "Welcome to Justice AI - Pakistani Legal Research Assistant",
        "docs": "/docs",
        "version": "1.0.0",
    }
