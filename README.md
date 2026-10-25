# ⚖️ Justice AI

**AI-powered legal research assistant for Pakistan** — ask any legal question in plain language and get a clear, **citation-backed** answer drawn from real Supreme Court and High Court judgments, federal and provincial statutes, and judge profiles.

> Pakistani lawyers lose hours to slow, scattered, manual legal research. Justice AI searches thousands of real judgments and statutes together, then answers with grounded analysis in seconds — never a fabricated case.

---

## ✨ Features

- **Ask in plain language** — pose a legal question the way you'd ask a colleague, in English or Urdu.
- **Grounded, citation-backed answers** — every answer is tied to real authority you can open and verify. If the law isn't in the record, it says so.
- **Hybrid retrieval** — combines semantic meaning and exact keyword matching for precise results across a large corpus.
- **Full court coverage** — Supreme Court of Pakistan, Islamabad High Court and Lahore High Court, plus federal and Punjab laws, searched together.
- **Conversational** — natural follow-up questions that remember the thread.
- **Streaming answers** — responses are written out live, with status updates while the system searches and reviews.
- **Case workspace** — document upload & analysis, a case diary, and automatic **hearing reminders** by email and WhatsApp.
- **Secure accounts** — Google sign-in and JWT-based sessions.

---

## 🧠 How It Works

Justice AI uses an **agentic RAG (Retrieval-Augmented Generation)** pipeline that reasons about each question before answering:

```
Question
   │
   ▼
Understand & contextualize   ← rewrites follow-ups into standalone queries
   │
   ▼
Hybrid search               ← dense (semantic) + sparse (BM25) fused with RRF
   │
   ▼
Re-rank                     ← most relevant passages rise to the top
   │
   ▼
Verify grounding            ← checks the answer is supported by the sources
   │
   ▼
Synthesize cited answer     ← streamed to the user with citations
```

1. **Ask** — type your legal question in plain Urdu or English.
2. **Search** — hybrid AI search scans tens of thousands of legal passages by both meaning and exact keyword.
3. **Rank** — the most relevant judgments and provisions are re-ranked and surfaced.
4. **Answer** — a grounded, citation-backed answer is written as you watch, with follow-up questions welcome.

---

## 🏗️ Tech Stack

**Backend & API**
- Python, FastAPI, Uvicorn
- Server-Sent Events (SSE) for streaming

**AI / RAG**
- LangGraph (agentic orchestration) & LangChain
- Groq (LLM inference)
- Voyage AI (embeddings + reranking)
- Qdrant (vector database, native hybrid search)
- FastEmbed / BM25 (sparse vectors)
- Sentence-Transformers & Hugging Face (fallback embeddings / reranking)

**Data & Ingestion**
- tiktoken (structure-aware chunking)
- pdfplumber, pdf2image, pytesseract, RapidOCR (document parsing & OCR)

**Database & Auth**
- SQLAlchemy + Alembic (migrations)
- Google OAuth + JWT
- Firebase (frontend auth)

**Notifications & Scheduling**
- APScheduler (hearing-date checks)
- SMTP email + Twilio WhatsApp (reminders)

**Frontend**
- React, Vite, Tailwind CSS
- React Router, React Markdown, Lucide icons

---

## 📁 Project Structure

```
.
├── main.py                 # FastAPI app entrypoint
├── requirements.txt
├── alembic/                # Database migrations
├── backend/
│   ├── auth.py             # Auth helpers (Google OAuth + JWT)
│   ├── routes/             # API routes (chat, chat_sessions, documents,
│   │                       #   hearings, ingest, auth, health)
│   ├── services/           # Core logic
│   │   ├── agent.py        # Agent runner + streaming generator
│   │   ├── graph.py        # LangGraph state machine
│   │   ├── nodes.py        # Graph nodes (understand, dispatch, verify, synthesize)
│   │   ├── tools.py        # Retrieval tools (hybrid search, rerank)
│   │   ├── embeddings.py   # Voyage embeddings (+ HF fallback)
│   │   ├── sparse.py       # BM25 sparse vectors
│   │   ├── qdrant.py       # Vector store schema & client
│   │   ├── ingestion.py    # Unified ingestion pipeline
│   │   ├── chunking.py     # Structure-aware chunking
│   │   ├── llm.py          # Groq LLM config
│   │   ├── notifications.py# Email / WhatsApp alerts
│   │   └── scheduler.py    # Hearing reminder scheduler
│   ├── interactors/        # Use-case layer
│   ├── database/           # Models & repositories
│   └── schemas/            # Pydantic schemas
├── data/                   # Source legal corpus
│   ├── sc_data/            # Supreme Court judgments
│   ├── isb_data/           # Islamabad High Court judgments
│   ├── lhc_data/           # Lahore High Court judgments
│   ├── federal_laws/       # Federal statutes
│   └── punjab_province_laws/ # Punjab provincial laws
├── ingest_*.py             # Per-source ingestion scripts
├── run_reingest.py         # Full re-ingestion orchestrator
├── migrate_to_v3.py        # Blue-green collection migration
└── frontend/               # React + Vite app
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A running **Qdrant** instance (local or cloud)
- API keys: **Groq**, **Voyage AI** (and optionally Twilio / SMTP for reminders)

### 1. Backend

```bash
# Clone and enter the project
git clone <your-repo-url>
cd WakeelsAI

# Create & activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (see Environment Variables below)
cp .env.example .env            # then fill in your keys

# Run database migrations
alembic upgrade head

# Start the API
uvicorn main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`).

### 2. Ingest the legal corpus

Populate the Qdrant collection from the source data:

```bash
python run_reingest.py          # ingest all sources
# or run individual sources:
python ingest_sc_cases.py
python ingest_isb_cases.py
python ingest_federal_laws.py
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                     # dev server (Vite)
# npm run build                 # production build
```

---

## 🔑 Environment Variables

Create a `.env` file in the project root. **Never commit real secrets.**

| Variable | Description |
|---|---|
| `GROQ_API_KEY`, `GROQ_LLM_MODEL` | Groq LLM credentials & model |
| `VOYAGE_API_KEY`, `VOYAGE_MODEL`, `VOYAGE_RERANK_MODEL` | Voyage embeddings & reranker |
| `EMBEDDING_DIM`, `EMBEDDING_BATCH_SIZE` | Embedding dimensions & batch size |
| `HF_EMBEDDING_MODEL`, `EMBEDDING_DEVICE` | Fallback HF embedding model & device |
| `QDRANT_URL`, `QDRANT_API_KEY` | Qdrant connection |
| `QDRANT_COLLECTION_NAME`, `QDRANT_VECTOR_SIZE` | Qdrant collection & vector size |
| `HYBRID_DENSE_WEIGHT`, `HYBRID_RRF_K` | Hybrid-search fusion tuning |
| `DATABASE_URL` | SQL database connection string |
| `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID` | Auth secrets |
| `SMTP_EMAIL`, `SMTP_APP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT` | Email reminders |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp reminders |
| `CACHE_*`, `QUERY_REWRITER_*`, `CONTEXT_COMPRESSION_*` | Caching & retrieval tuning |

---

## 📚 Corpus

Justice AI indexes a corpus of Pakistani legal material, including:

- **Supreme Court** and **High Court** (Islamabad & Lahore) judgments
- **Federal** and **Punjab** statutes
- **Judge profiles**

Documents are parsed (with OCR where needed), chunked in a structure-aware way, embedded, and stored in Qdrant with both dense and sparse vectors for hybrid retrieval. Ingestion is deterministic and idempotent, so re-runs don't create duplicates.

---

## 🗺️ Roadmap

- Expand coverage to more provincial High Courts and tribunals
- Richer case-workspace collaboration features
- Deeper analytics on judge and court trends

---

## 📄 About

Justice AI (internally codenamed *Wakeels AI*) is a Final Year Project built to make Pakistani legal research faster, more reliable, and accessible in plain language.

*This project is for research and educational purposes. It is a research assistant, not a substitute for professional legal advice.*
