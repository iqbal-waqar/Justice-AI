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
- OpenAI (LLM inference — GPT-4.1 family)
- Voyage AI (embeddings + reranking)
- Qdrant (vector database, native hybrid search)
- FastEmbed / BM25 (sparse vectors)

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
│   │   ├── embeddings.py   # Voyage embeddings (+ query-vector cache)
│   │   ├── sparse.py       # BM25 sparse vectors
│   │   ├── qdrant.py       # Vector store schema & client
│   │   ├── ingestion.py    # Unified ingestion pipeline
│   │   ├── chunking.py     # Structure-aware chunking
│   │   ├── llm.py          # OpenAI LLM config
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
- **PostgreSQL** (app data: users, hearings, case notes, chats)
- **Redis** (recommended — answer cache that survives restarts and is shared across workers; without it the cache falls back to in-memory). Ubuntu: `sudo apt install redis-server`
- For scanned-PDF OCR: `tesseract-ocr` and `poppler-utils`
- API keys: **OpenAI**, **Voyage AI**, **Meta WhatsApp Cloud API** (optional, for reminders), SMTP (optional)

### 1. Backend

```bash
# Clone and enter the project
git clone <your-repo-url>
cd Justice-AI

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

**Admin access.** Ingestion and cache-management endpoints (`/ingest`, `/ingest/stats`, `/cache/stats`, `/cache/clear`) require the `admin` role. There is deliberately no API to grant it — run this on the server after the user has signed up:

```bash
python make_admin.py you@example.com     # grant
python make_admin.py --list              # list admins
python make_admin.py you@example.com --revoke
```

`/ingest` only reads `.jsonl` files inside the project's `data/` directory.

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
| `OPENAI_API_KEY`, `OPENAI_LLM_MODEL`, `OPENAI_ASSESS_MODEL` | OpenAI credentials; synthesis model & relevance-gate model (default `gpt-4.1-mini`) |
| `CONTEXT_MAX_TOTAL_CHARS` | Retrieved-document budget passed to the LLM (default 30000) |
| `VOYAGE_API_KEY`, `VOYAGE_MODEL`, `VOYAGE_RERANK_MODEL` | Voyage embeddings & reranker |
| `EMBEDDING_DIM`, `EMBEDDING_BATCH_SIZE` | Embedding dimensions & batch size |
| `QUERY_EMBED_CACHE_SIZE` | Query embeddings kept in memory (default 512) |
| `QDRANT_URL`, `QDRANT_API_KEY` | Qdrant connection |
| `QDRANT_COLLECTION_NAME`, `QDRANT_VECTOR_SIZE` | Qdrant collection & vector size |
| `DATABASE_URL` | SQL database connection string |
| `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID` | Auth secrets |
| `AGENT_MAX_RETRIES` | Extra search rounds when results are weak (default 1) |
| `GATE_SKIP_SCORE` | Top rerank score at/above which the LLM relevance review is skipped (default 0.75) |
| `SMTP_EMAIL`, `SMTP_APP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT` | Email reminders |
| `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`, `META_WA_API_VERSION` | WhatsApp hearing reminders (Meta WhatsApp Cloud API) |
| `REDIS_URL` | Redis for the answer cache, e.g. `redis://localhost:6379/0` (unset/unreachable → in-memory) |
| `CACHE_ANSWER_TTL_DAYS`, `CACHE_MAX_SIZE` | Answer-cache lifetime; in-memory size cap |
| `RETRIEVAL_HYBRID_K`, `RETRIEVAL_FINAL_CASES`, `RETRIEVAL_FINAL_CASES_COMPLEX`, `RETRIEVAL_CHUNKS_PER_CASE` | Search funnel: hybrid candidates (48) → all re-ranked → distinct cases kept (6 / 8 for complex questions), up to 2 passages each |
| `OPENAI_UNDERSTAND_MODEL` | Model for the query-understanding step (intent, follow-ups, language, English search query); defaults to the assess model |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_STT_MODEL` | Voice questions: speech-to-text via ElevenLabs Scribe (`scribe_v1`) |
| `VAULT_ENCRYPTION_KEY` | **Required for the document vault.** Base64 of 32 random bytes; every file is AES-256-GCM encrypted with it. Back it up — losing it makes stored documents unreadable |
| `STORAGE_BACKEND` | `local` (development, files in `storage/vault/`) or `s3` (Cloudflare R2 / AWS S3 / Backblaze B2) |
| `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Object storage for the vault. For Cloudflare R2: endpoint `https://<account-id>.r2.cloudflarestorage.com`, region `auto` |

### Document vault & billing

- **Vault** — files are encrypted inside the app (AES-256-GCM) before they reach storage, so the cloud provider only holds ciphertext; tampering is detected on download; every upload, view, download, edit and delete is logged (owners/partners can see the log). Allowed: PDF, Word, Excel, JPG, PNG, TXT up to 25 MB, checked by content, not just extension.
- **Cloud storage (recommended: Cloudflare R2)** — create a bucket, then an R2 API token with *Object Read & Write* on that bucket, and set `STORAGE_BACKEND=s3` plus the `S3_*` variables. Keep the bucket private (no public access); the app streams files to signed-in users itself.
- **Billing** — fees, case expenses and payments per client and case, in PKR. Maker-checker: anyone records an entry, an owner or partner approves it, and nobody approves their own entry unless the owner enables self-approval (solo practice; such approvals are flagged). Only approved entries count; approved entries are locked and can only be voided with a reason. Client statements export as PDF.
- **Team** — every user gets a firm automatically. Owners invite colleagues by email as partner, associate or clerk; people join only by accepting the invitation from their own account.

---

## 📏 Evaluation (Ragas)

Answer quality is measured with [Ragas](https://docs.ragas.io) on a fixed set of test questions with checked reference answers (`evaluation/questions.json`). Ragas runs in its own environment so its packages never touch the app's.

```bash
# one-time setup
python3 -m venv evaluation/.venv
evaluation/.venv/bin/pip install -r evaluation/requirements.txt

# run (asks the questions through the real agent, then scores them)
evaluation/run.sh --limit 5 --label "first test"
```

Each run is saved in `evaluation/results/<date_time>/` with `answers.jsonl`, `scores.csv`, `summary.json` and `report.html` (open it in a browser). The judge is `gpt-4.1-mini` (`EVAL_JUDGE_MODEL`).

| Metric | What it measures |
|---|---|
| Faithfulness | Share of the answer's statements supported by the passages it was written from (hallucination check) |
| Answer relevancy | How directly the answer addresses the question |
| Context precision | Whether the retrieved passages are on point and ranked well |
| Context recall | Whether retrieval found what the reference answer needs |
| Factual correctness | Agreement between the answer's claims and the reference answer |

Urdu questions carry a `question_en` used only for answer relevancy, whose embedding comparison is unreliable across scripts. Questions with `"expect": "not_covered"` are scored as pass/fail (the agent should decline).

## 📚 Corpus

Justice AI indexes a corpus of Pakistani legal material, including:

- **Supreme Court** and **High Court** (Islamabad & Lahore) judgments
- **Federal** and **Punjab** statutes, including the full **Pakistan Penal Code, 1860** and **Code of Criminal Procedure, 1898** (`ingest_core_codes.py`)
- **Lahore High Court Rules and Orders**, Volumes I–IV (`ingest_court_rules.py`)
- **Judge profiles**

Documents are parsed (with OCR where needed), chunked in a structure-aware way, embedded, and stored in Qdrant with both dense and sparse vectors for hybrid retrieval. Ingestion is deterministic and idempotent, so re-runs don't create duplicates.

---

## 🗺️ Roadmap

- Expand coverage to more provincial High Courts and tribunals
- Richer case-workspace collaboration features
- Deeper analytics on judge and court trends

---

## 📄 About

Justice AI is a Final Year Project built to make Pakistani legal research faster, more reliable, and accessible in plain language.

*This project is for research and educational purposes. It is a research assistant, not a substitute for professional legal advice.*
