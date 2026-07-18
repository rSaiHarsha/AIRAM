# AIRAM — AI-Assisted Requirement Analysis & Management

## Complete Technical Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Project Structure & File Map](#3-project-structure--file-map)
4. [Core Features & Functionalities](#4-core-features--functionalities)
   - 4.1 [Requirements Quality Auditor](#41-requirements-quality-auditor)
   - 4.2 [Requirements Quality Corrector](#42-requirements-quality-corrector)
   - 4.3 [Requirements Traceability Analyzer](#43-requirements-traceability-analyzer)
   - 4.4 [RAG (Retrieval-Augmented Generation) Engine](#44-rag-retrieval-augmented-generation-engine)
   - 4.5 [Manual Retrieval Evaluation](#45-manual-retrieval-evaluation)
   - 4.6 [Interactive Dashboard](#46-interactive-dashboard)
   - 4.7 [Execution Control (Pause / Resume / Stop)](#47-execution-control-pause--resume--stop)
   - 4.8 [Standards & Guidelines Management](#48-standards--guidelines-management)
5. [Backend Specifications](#5-backend-specifications)
   - 5.1 [FastAPI Application & Lifespan](#51-fastapi-application--lifespan)
   - 5.2 [REST API Endpoints](#52-rest-api-endpoints)
   - 5.3 [WebSocket Endpoint](#53-websocket-endpoint)
   - 5.4 [Database Schema (SQLite)](#54-database-schema-sqlite)
   - 5.5 [LLM Manager](#55-llm-manager)
   - 5.6 [Requirement Data Model](#56-requirement-data-model)
   - 5.7 [Quality Analyser Engine](#57-quality-analyser-engine)
   - 5.8 [Traceability Analyser Engine](#58-traceability-analyser-engine)
   - 5.9 [RAG Engine (Vector Store)](#59-rag-engine-vector-store)
   - 5.10 [RAG Service (Orchestrator)](#510-rag-service-orchestrator)
   - 5.11 [Analyzer Service (Job Runner)](#511-analyzer-service-job-runner)
6. [Frontend Specifications](#6-frontend-specifications)
   - 6.1 [Angular Application Structure](#61-angular-application-structure)
   - 6.2 [API Service](#62-api-service)
   - 6.3 [Dashboard Component](#63-dashboard-component)
   - 6.4 [Requirements Component](#64-requirements-component)
   - 6.5 [RAG Configuration Component](#65-rag-configuration-component)
   - 6.6 [Design System & Styling](#66-design-system--styling)
7. [Data Flow & Processing Pipelines](#7-data-flow--processing-pipelines)
   - 7.1 [Quality Analysis Pipeline](#71-quality-analysis-pipeline)
   - 7.2 [Traceability Analysis Pipeline](#72-traceability-analysis-pipeline)
   - 7.3 [RAG Training Pipeline](#73-rag-training-pipeline)
8. [File Format Support](#8-file-format-support)
9. [LLM Prompt Engineering](#9-llm-prompt-engineering)
10. [Environment Configuration](#10-environment-configuration)
11. [External Dependencies](#11-external-dependencies)
12. [Testing](#12-testing)
13. [Deployment Modes](#13-deployment-modes)

---

## 1. Project Overview

**AIRAM** (AI-Assisted Requirement Analysis & Management) is a full-stack, agentic automotive requirements analysis and compliance validation platform. It targets automotive software engineering teams working under standards such as **ASPICE** (Automotive SPICE), **INCOSE** (International Council on Systems Engineering), and **EARS** (Easy Approach to Requirements Syntax).

### Key Capabilities

| Capability | Description |
|---|---|
| **Quality Auditing** | Evaluates individual requirements against INCOSE/EARS/custom rules using LLMs, returning PASS or REVIEW verdicts with rationale |
| **Quality Correction** | Automatically rewrites non-compliant requirements to satisfy violated rules |
| **Traceability Analysis** | Evaluates bidirectional tracing between SWE.1 (HLR) and SWE.2 (LLR) requirements using LLM-based semantic matching |
| **RAG Ingestion** | Progressively chunks, embeds, and indexes guideline documents (PDF, Excel, CSV, JSON, TXT) into a Qdrant vector database |
| **Manual Retrieval** | Lets users query the vector DB to verify semantic retrieval relevance scores |
| **Interactive Dashboard** | Visualizes execution history, stacked compliance statistics, and chunking metrics |
| **Execution Control** | Pause, resume, and stop long-running analysis jobs mid-execution |

---

## 2. Architecture & Technology Stack

### System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Angular 22 Frontend                  │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────────┐│
│  │Dashboard │  │Requirements     │  │RAG Configuration ││
│  │Component │  │Analysis Component│  │Component         ││
│  └────┬─────┘  └────────┬────────┘  └────────┬─────────┘│
│       │                 │                     │          │
│       └────────┬────────┴─────────────────────┘          │
│                │  ApiService (HttpClient + Fetch SSE)     │
└────────────────┼─────────────────────────────────────────┘
                 │  HTTP REST + WebSocket + SSE
┌────────────────┼─────────────────────────────────────────┐
│                │      FastAPI Backend (Python)            │
│  ┌─────────────┴──────────────┐                          │
│  │     main.py (API Router)   │                          │
│  └──┬──────┬──────┬───────────┘                          │
│     │      │      │                                      │
│  ┌──┴──┐┌──┴───┐┌─┴───────────┐                         │
│  │DB   ││RAG   ││Analyzer     │                          │
│  │Layer││Service││Service      │                          │
│  └──┬──┘└──┬───┘└──┬──────────┘                          │
│     │      │       │                                     │
│  ┌──┴──┐┌──┴────┐┌─┴──────────────────┐                 │
│  │SQLite││RAG   ││Analysis Engine      │                 │
│  │ DB  ││Engine ││(Quality + Trace)    │                 │
│  └─────┘└──┬────┘└──┬─────────────────┘                  │
│            │        │                                    │
│         ┌──┴────────┴──┐                                 │
│         │  LLM Manager │                                 │
│         └──────┬───────┘                                 │
└────────────────┼─────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │  NVIDIA NIM API         │
    │  (LLama 3.3 Nemotron)   │
    │  + Embedding (nv-e5-v5) │
    └────────────┬────────────┘
                 │
    ┌────────────┴────────────┐
    │  Qdrant Cloud           │
    │  (Vector Database)      │
    └─────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | Angular | 22.x |
| **Frontend Language** | TypeScript | 6.x |
| **Backend Framework** | FastAPI | Latest |
| **Backend Language** | Python | 3.10+ |
| **ASGI Server** | Uvicorn | Latest |
| **Database** | SQLite (WAL mode) | Built-in |
| **Vector Database** | Qdrant Cloud | Latest |
| **LLM Provider** | NVIDIA NIM API | — |
| **LLM Model (Analysis)** | `nvidia/llama-3.3-nemotron-super-49b-v1.5` | — |
| **Embedding Model** | `nvidia/nv-embedqa-e5-v5` | — |
| **PDF Processing** | PyMuPDF + pymupdf4llm | Latest |
| **Excel Processing** | pandas + openpyxl | Latest |

---

## 3. Project Structure & File Map

```
ReQualiTrace_Studio/
├── README.md                          # Quick start guide
├── DOCUMENTATION.md                   # This file — complete documentation
├── .gitignore
├── artefacts/                         # Sample requirement & rule files
│   ├── Swe2_req.csv                   # Sample SWE.2 requirements CSV
│   ├── Lane Keep Assist/              # Sample project requirements
│   └── rules/                         # Pre-built strict guideline JSON files
│       ├── rules_42.json              # 42-rule comprehensive ruleset
│       ├── rules_ears_all_25_with_category.json
│       └── rules_ears_canonical_16.json
├── output/                            # Screenshots / output artifacts
│   ├── 1.PNG – 5.PNG
├── backend/                           # Python FastAPI backend
│   ├── .env                           # Environment variables (API keys)
│   ├── main.py                        # FastAPI application entry point
│   ├── database.py                    # SQLite database schema & accessors
│   ├── analyzer_service.py            # Async job runner for analysis
│   ├── rag_service.py                 # RAG training & search orchestrator
│   ├── test_backend.py                # Integration test suite
│   ├── requirements.txt               # Python dependencies
│   ├── airam.db                       # SQLite database file (auto-created)
│   ├── Model/
│   │   ├── llm.py                     # LLMManager — NVIDIA NIM API client
│   │   └── requirement.py             # Requirement data model class
│   ├── Analysis/
│   │   ├── __init__.py
│   │   ├── analyzer.py                # RequirementAnalyzer facade class
│   │   ├── quality_analyser.py        # Quality analysis & correction engine
│   │   └── traceability_analyser.py   # Traceability analysis engine
│   └── RagEngine/
│       └── rag_engine.py              # RAGEngine — vector store & chunking
└── frontend/                          # Angular 22 SPA frontend
    ├── angular.json                   # Angular workspace config
    ├── package.json                   # npm dependencies
    ├── start.js                       # Custom dev server launcher
    ├── tsconfig.json                  # TypeScript configuration
    ├── src/
    │   ├── index.html                 # HTML entry point
    │   ├── main.ts                    # Angular bootstrap
    │   ├── styles.css                 # Global design system
    │   └── app/
    │       ├── app.ts                 # Root component (header + tab nav)
    │       ├── app.html               # Default Angular template (placeholder)
    │       ├── app.css
    │       ├── app.config.ts          # Application config & providers
    │       ├── app.routes.ts          # Routing configuration
    │       ├── services/
    │       │   └── api.service.ts     # HttpClient API service
    │       └── components/
    │           ├── dashboard/
    │           │   └── dashboard.ts   # Dashboard view component
    │           ├── requirements/
    │           │   └── requirements.ts # Analysis execution component
    │           └── rag-config/
    │               └── rag-config.ts  # RAG ingestion & search component
```

---

## 4. Core Features & Functionalities

### 4.1 Requirements Quality Auditor

**Purpose:** Evaluates individual software requirements (SWE.1 HLR or SWE.2 LLR) against engineering guidelines using LLMs.

**Analysis Modes:**

| Mode | Description |
|---|---|
| **RAG Mode** | Queries semantically relevant chunks from the Qdrant vector database as context for the LLM audit |
| **Strict JSON Rules Mode** | Injects the full JSON rule definitions directly into the LLM system prompt. The LLM is instructed to use ONLY the provided rules with zero external knowledge |
| **Custom Context Mode** | Injects user-provided free-text evaluation criteria into the system prompt |

**Audit Output (per requirement):**

| Field | Description |
|---|---|
| `status` | `PASS` or `REVIEW` — whether the requirement passes all rules |
| `failed_rules` | List of violated rule names/IDs (empty if PASS) |
| `rationale` | LLM explanation of why each rule was satisfied or violated |

**Key Features:**
- **Recheck Mechanism:** All requirements that initially PASS are re-analyzed in a second pass with the LLM. If the second evaluation catches a subtle violation that was missed, the result flips to REVIEW and is tagged with `[Caught on recheck]`.
- **Batch Processing:** Multiple requirements can be analyzed in a single LLM call (batch mode) for throughput, with automatic fallback to single-requirement analysis if the batch call fails.
- **Parallel Execution:** Uses `ThreadPoolExecutor` with up to 8 workers for concurrent analysis.
- **Configurable LLM Model:** The model can be changed per execution run.

### 4.2 Requirements Quality Corrector

**Purpose:** Automatically rewrites non-compliant requirements to satisfy violated INCOSE/EARS rules.

**Correction Features:**
- Receives the original requirement text, violated rule names, and analysis rationale as input
- In Strict JSON Rules mode, injects the **full rule definitions** of violated rules into the correction prompt
- Supports **requirement splitting** — if a requirement contains multiple actions, it is split into atomic requirements
- Supports custom correction context via user-provided free text
- Output is a list of corrected requirement strings

**Correction Output Schema:**
```json
{
  "split_required": true/false,
  "corrected_requirements": ["Corrected req 1", "Corrected req 2", ...]
}
```

### 4.3 Requirements Traceability Analyzer

**Purpose:** Evaluates bidirectional tracing compliance between High-Level Requirements (SWE.1 / HLR) and Low-Level Requirements (SWE.2 / LLR).

**How it works:**
1. For each SWE.1 (HLR) requirement, the LLM is asked to identify which SWE.2 (LLR) requirements properly trace to and satisfy it
2. The LLM returns a structured JSON response containing linked SWE.2 IDs, a status (PASS/FAIL/REVIEW), and a rationale
3. After all SWE.1 requirements are processed, any SWE.2 requirements not linked to any SWE.1 are flagged as **Orphaned LLDs** with a FAIL status

**Traceability Output (per SWE.1 requirement):**

| Field | Description |
|---|---|
| `status` | `PASS` if valid SWE.2 links found, `FAIL` if none, `REVIEW` if uncertain |
| `linked_swe2_ids` | Array of matched SWE.2 requirement IDs |
| `rationale` | LLM explanation of why the trace is valid or invalid |

**Metrics Calculated:**

| Metric | Description |
|---|---|
| `total_hld` | Total number of SWE.1 requirements |
| `covered_count` | Number of SWE.1 requirements with valid SWE.2 traces |
| `orphaned_count` | Number of SWE.1 requirements without SWE.2 coverage |
| `coverage_pct` | Percentage of SWE.1 requirements covered |

### 4.4 RAG (Retrieval-Augmented Generation) Engine

**Purpose:** Ingests, chunks, embeds, and indexes guideline documents into a vector database for semantic retrieval during analysis.

**Supported File Types:**

| File Type | Processing Strategy |
|---|---|
| **PDF** | Layout-aware extraction using `pymupdf4llm`, chunked per page with configurable page ranges. Oversized pages are split at 1800 characters |
| **Excel (.xlsx/.xls)** | Parsed via `pandas`, batched into groups of 15 rows formatted as Markdown tables |
| **CSV** | Parsed row-by-row using `csv.DictReader`, each row becomes a chunk |
| **JSON** | Pretty-printed and segmented by paragraph blocks |
| **Text (.txt)** | Segmented by blank lines / paragraphs into blocks |

**Vector Storage:**
- **Primary:** Qdrant Cloud vector database with cosine similarity
- **Fallback:** In-memory NumPy-based cosine similarity search
- **Embedding Model:** `nvidia/nv-embedqa-e5-v5` (dimension auto-detected at startup)

**Collection Management:**
- Create new collections or append to existing ones
- Delete collections from Qdrant
- Payload keyword indexes on `metadata.item_type`, `metadata.item_id`, `metadata.page`
- Full-text search index on `text` field using word tokenizer

**Chunking Features:**
- Automatic oversized chunk splitting at 1800 characters using `textwrap.wrap`
- Context preservation: subsequent sub-chunks are prepended with `[Continued from '{title}':]`
- Each sub-chunk gets a new UUID and parent reference metadata
- Rate limit handling with exponential backoff (up to 5 retries)

### 4.5 Manual Retrieval Evaluation

**Purpose:** Allows users to manually query the vector database and verify that semantic retrieval returns relevant results with appropriate similarity scores.

**Features:**
- Free-text search box for entering queries
- Configurable result limit (default: 5)
- Target collection selection (dropdown of all available Qdrant collections)
- Returns matched text snippets, source document name, and cosine similarity score
- Score threshold: only results with score > 0.3 are included in context blocks

### 4.6 Interactive Dashboard

**Purpose:** Provides an at-a-glance overview of all analysis executions, compliance statistics, and system health.

**Dashboard Features:**
- **Execution History:** Paginated list of previous analysis runs with timestamps, type, status, and compliance counts
- **Stacked Compliance Stats:** Visual breakdown of PASS / FAIL / REVIEW counts per run
- **Run Cards:** Expandable/collapsible cards for each execution with minimize/restore support
- **Quick Actions:** View results, delete runs, navigate to new execution
- **Backend Status Indicator:** Real-time WebSocket-based connection health (Connected / Connecting / Disconnected)

### 4.7 Execution Control (Pause / Resume / Stop)

**Purpose:** Long-running analysis jobs can be controlled in real-time.

**Control Flow:**

| Action | Behavior |
|---|---|
| **Pause** | Sets job status to `paused` in DB; the row-by-row loop enters a sleep-poll cycle (0.5s) until resumed |
| **Resume** | Sets job status back to `running`; the loop exits the pause cycle and continues processing |
| **Stop** | Sets job status to `stopped`; the loop exits immediately, rules state is cleaned up |

**State Tracking:**
- **In-Memory:** `ACTIVE_JOBS` dictionary (for backward compatibility)
- **Database (Source of Truth):** `execution_runs` table with `status`, `current_row`, `total_rows`
- Frontend polls `/api/analysis/{run_id}/status` for progress updates

### 4.8 Standards & Guidelines Management

**Purpose:** Upload, edit, and delete strict guideline rule files used in JSON Rules analysis mode.

**Features:**
- Upload JSON rule files with a custom name
- View all uploaded guidelines with creation timestamps
- Edit guideline name and JSON content inline
- Delete guidelines
- Support for multi-file guideline layouts (each file becomes a named section)
- Support for combining multiple guideline files in a single analysis run (comma-separated IDs)

---

## 5. Backend Specifications

### 5.1 FastAPI Application & Lifespan

| Property | Value |
|---|---|
| **Title** | `AIRAM Backend` |
| **Server** | Uvicorn, host `0.0.0.0`, port `8000`, auto-reload |
| **CORS** | All origins (`*`), all methods, all headers |
| **Lifespan** | Database initialization on startup via `init_db()` |

### 5.2 REST API Endpoints

#### Guidelines Endpoints

| Method | Endpoint | Description | Input |
|---|---|---|---|
| `POST` | `/api/guidelines/upload` | Upload a strict guideline JSON file | `name` (form), `file` (upload) |
| `GET` | `/api/guidelines` | List all guidelines | — |
| `PUT` | `/api/guidelines/{guideline_id}` | Update a guideline's name and content | `name`, `content` (JSON body) |
| `DELETE` | `/api/guidelines/{guideline_id}` | Delete a guideline | — |

#### RAG Endpoints

| Method | Endpoint | Description | Input |
|---|---|---|---|
| `POST` | `/api/rag/train` | Ingest & chunk a file, returns SSE stream | `file`, `collection_name`, `collection_mode`, `start_page`, `end_page` |
| `POST` | `/api/rag/inspect-pdf` | Get PDF page count | `file` (upload) |
| `GET` | `/api/rag/collections` | List all Qdrant collections | — |
| `GET` | `/api/rag/metrics` | Get chunking metrics (total chunks, tokens, avg) | — |
| `GET` | `/api/rag/search` | Manual semantic search | `query`, `limit`, `collection_name` |

#### Analysis Endpoints

| Method | Endpoint | Description | Input |
|---|---|---|---|
| `POST` | `/api/analysis/start` | Start an async analysis job | `run_type`, `guideline_id`, `use_rag`, `model_name`, `swe1_file`, `swe2_file`, `correct_quality`, `correct_trace`, `custom_context`, `custom_context_correction` |
| `POST` | `/api/analysis/{run_id}/pause` | Pause a running job | — |
| `POST` | `/api/analysis/{run_id}/resume` | Resume a paused job | — |
| `POST` | `/api/analysis/{run_id}/stop` | Stop a running job | — |
| `GET` | `/api/analysis/{run_id}/status` | Get job progress | — |
| `GET` | `/api/analysis/{run_id}/results` | Get all row results | — |
| `GET` | `/api/analysis/history` | List execution summaries | `limit`, `offset` |
| `POST` | `/api/analysis/{run_id}/minimize` | Minimize/restore a run card | `minimized` |
| `DELETE` | `/api/analysis/{run_id}` | Delete an execution run | — |

### 5.3 WebSocket Endpoint

| Endpoint | Purpose |
|---|---|
| `ws://localhost:8000/api/ws/status` | Backend health check — frontend opens a persistent WebSocket connection; if it closes, the UI shows "DISCONNECTED" and auto-reconnects every 3 seconds |

### 5.4 Database Schema (SQLite)

**File:** `airam.db` (WAL journal mode, 20s timeout)

#### `guidelines` Table

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | UUID |
| `name` | TEXT | Guideline display name |
| `content` | TEXT | JSON-serialized rule content |
| `created_at` | TIMESTAMP | Auto-set creation timestamp |

#### `chunks` Table

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK) | Auto-increment |
| `doc_name` | TEXT | Source filename |
| `chunk_index` | INTEGER | Chunk ordinal within document |
| `chunk_text` | TEXT | Chunk text content |
| `token_count` | INTEGER | Approximate token count |
| `qdrant_id` | TEXT | Corresponding Qdrant point UUID |
| `embedded_at` | TIMESTAMP | Embedding timestamp |

#### `execution_runs` Table

| Column | Type | Description |
|---|---|---|
| `run_id` | TEXT (PK) | UUID |
| `timestamp` | TIMESTAMP | Auto-set |
| `type` | TEXT | `quality`, `traceability`, or `combined` |
| `status` | TEXT | `running`, `paused`, `stopped`, or `completed` |
| `minimized` | INTEGER | 0 = normal, 1 = minimized in UI |
| `current_row` | INTEGER | Current processing row |
| `total_rows` | INTEGER | Total rows to process |
| `guideline_name` | TEXT | Name of selected guideline |

#### `execution_results` Table

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK) | Auto-increment |
| `run_id` | TEXT (FK) | References `execution_runs.run_id` |
| `req_id` | TEXT | Requirement ID |
| `input_req` | TEXT | Original requirement text |
| `status` | TEXT | `PASS`, `FAIL`, `REVIEW`, or `PROCESSING` |
| `failed_rule` | TEXT | Violated rule names (comma-separated) |
| `rationale` | TEXT | LLM-generated explanation |
| `corrected_req` | TEXT | Corrected requirement text |
| `swe1_id` | TEXT | Parent SWE.1 ID (traceability mode) |
| `swe1_text` | TEXT | Parent SWE.1 text (traceability mode) |
| `category` | TEXT | `swe1`, `swe2`, or `traceability` |

### 5.5 LLM Manager

**File:** `backend/Model/llm.py`

**Class:** `LLMManager`

| Property | Default Value |
|---|---|
| `model_name` | `nvidia/llama-3.3-nemotron-super-49b-v1.5` |
| `rag_model_name` | `nvidia/llama-3.3-nemotron-super-49b-v1.5` |
| `analysis_model_name` | `nvidia/llama-3.3-nemotron-super-49b-v1.5` |
| `embedding_model` | `nvidia/nv-embedqa-e5-v5` |
| `base_url` | `https://integrate.api.nvidia.com/v1` |
| `retries` | 3 (exponential backoff: 1s, 2s, 4s) |

**API Key Resolution Order:**
1. Streamlit secrets (`st.secrets["API_KEY"]`)
2. Environment variable `NVIDIA_API_KEY`
3. Fallback to `"mock-key"` (disables real API calls)

**Methods:**

| Method | Description |
|---|---|
| `get_response(messages, stream, model)` | Chat completion with 10-message sliding window, deterministic settings (temp=0.0, top_p=0.01, seed=42, max_tokens=8192). Validates non-empty responses. |
| `get_embedding(text)` | Single text embedding with `input_type=query`, truncation at END |
| `get_embeddings_batch(texts)` | Batch embeddings with `input_type=passage`, ordered by index |
| `_retry_api_call(func, *args)` | Retry wrapper with exponential backoff (3 retries) |

### 5.6 Requirement Data Model

**File:** `backend/Model/requirement.py`

**Class:** `Requirement`

| Attribute | Type | Description |
|---|---|---|
| `name` | str | Requirement ID (e.g., `HLR-001`) |
| `content` | str | Requirement text body |
| `state` | str | Lifecycle state |
| `asil` | str | ASIL safety level |
| `rationale` | str | Author's rationale |
| `covers` | str | Mapped parent requirement ID (for SWE.2→SWE.1 trace) |
| `refined` | str | Refinement reference |

**Methods:**
- `to_dict()` — Convert to CSV-row dictionary
- `to_json()` — JSON serialization
- `load_from_csv(path)` — Static: load list from CSV with dynamic header matching
- `save_to_csv(requirements, path)` — Static: save list to CSV

**Dynamic Header Matching:** The CSV loader automatically maps common header variants:
- **Name/ID:** `name`, `id`, `req_id`, `requirement_id`
- **Content:** `content`, `requirement`, `text`, `description`
- **State:** `state`, `status`
- **ASIL:** `asil`, `severity`
- **Covers:** `covers`, `mapped_swe1_id`

### 5.7 Quality Analyser Engine

**File:** `backend/Analysis/quality_analyser.py` (987 lines)

**Core Functions:**

| Function | Description |
|---|---|
| `analyze_single_requirement()` | Analyzes one requirement via LLM |
| `analyze_batch()` | Analyzes multiple requirements in one LLM call |
| `analyze_requirements()` | Orchestrates single-mode or batch-mode analysis with parallel execution |
| `analyze_requirements_batch()` | Batch processing with automatic fallback to single |
| `_recheck_passed_requirements()` | Second-pass recheck of PASS results to catch inconsistencies |
| `correct_single_requirement()` | Corrects one requirement via LLM |
| `correct_batch()` | Corrects multiple requirements in one LLM call |
| `correct_requirements()` | Orchestrates single/batch correction |
| `correct_requirements_batch()` | Batch correction with fallback |
| `generate_markdown_report()` | Generates a Markdown compliance report |
| `clean_and_parse_json()` | Extracts and parses JSON from LLM responses (handles markdown wrapping, trailing commas) |
| `normalize_parsed_item()` | Normalizes keys, status values, and failed rules format |
| `load_json_rules()` | Loads rules from global `CURRENT_RULES` or filesystem |
| `get_failed_rule_definitions()` | Looks up full rule definitions for violated rules |

**LLM Response Parsing:**
- Extracts JSON blocks from markdown-wrapped responses
- Handles both `{...}` objects and `[...]` arrays
- Strips trailing commas
- Normalizes status values (`Passed`/`Pass` → `Passed`, anything else → `Review`)
- Normalizes failed rules from string, list, or null formats

### 5.8 Traceability Analyser Engine

**File:** `backend/Analysis/traceability_analyser.py`

**Functions:**

| Function | Description |
|---|---|
| `analyze_traceability_from_swe1_with_llm()` | For one SWE.1 req, identifies matching SWE.2 reqs via LLM. Limits SWE.2 context to 100 requirements to prevent token overflow. |
| `compare_traceability()` | Full bidirectional mapping: iterates all SWE.1 reqs, collects linked SWE.2s, then identifies orphaned SWE.2s |

### 5.9 RAG Engine (Vector Store)

**File:** `backend/RagEngine/rag_engine.py` (752 lines)

**Class:** `RAGEngine`

**Constructor:**
- Initializes `LLMManager` reference
- Detects embedding dimension dynamically via test embedding
- Connects to Qdrant Cloud if `QDRANT_URL` is set

**Key Methods:**

| Method | Description |
|---|---|
| `process_file()` | Decodes and segments a file into chunks (PDF/Excel/CSV/JSON/TXT) |
| `setup_collection()` | Creates or recreates a Qdrant collection with proper vector config and payload indexes |
| `clear_database()` | Deletes a Qdrant collection |
| `train_engine()` | Computes embeddings for all documents and uploads to Qdrant |
| `load_trained_engine()` | Syncs documents from Qdrant back into memory |
| `ingest_chunk()` | Single chunk upsert with auto-splitting |
| `ingest_chunks_batch()` | Batch upsert with auto-splitting |
| `search()` | Cosine similarity search against Qdrant or local fallback |
| `query()` | Returns concatenated context text blocks (score > 0.3 threshold) |
| `query_batch()` | Batch query returning context blocks per search text |
| `get_all_chunks()` | Scrolls all points from a collection via Qdrant's scroll API |
| `get_collections()` | Lists all Qdrant collections |
| `_safe_get_embedding()` | Single embedding with rate-limit exponential backoff |
| `_safe_get_embeddings_batch()` | Batch embeddings with rate-limit backoff |
| `_split_oversized_chunk()` | Splits chunks > 1800 chars using `textwrap.wrap` |

### 5.10 RAG Service (Orchestrator)

**File:** `backend/rag_service.py`

**Functions:**

| Function | Description |
|---|---|
| `train_document_stream()` | Generator that processes a file, computes embeddings chunk-by-chunk, saves to SQLite + Qdrant, and yields SSE state objects for real-time frontend updates |
| `search_guideline_chunks()` | Searches the vector DB and returns formatted results with text, source, and score |

**SSE Stream Protocol:**

| Status | Payload |
|---|---|
| `started` | `{ status: "started", total_chunks: N, processed: 0 }` |
| `processing` | `{ status: "processing", total_chunks: N, processed: M, chunk: { index, text (150 chars), tokens } }` |
| `completed` | `{ status: "completed", total_chunks: N, metrics: { total_chunks, total_tokens, avg_tokens } }` |

### 5.11 Analyzer Service (Job Runner)

**File:** `backend/analyzer_service.py` (627 lines)

**Main Function:** `run_requirements_analysis_job()` — async background task that:

1. Parses uploaded CSV/XLSX files into `Requirement` objects with intelligent header mapping
2. Creates the execution run record in the database
3. Initializes `LLMManager` with the specified model
4. Processes requirements row-by-row with:
   - Pause/resume/stop polling via DB status checks
   - Placeholder "PROCESSING" results created before LLM call
   - Progressive UI updates via DB row tracking
   - RAG context fetching if enabled
5. For quality mode: calls `analyze_quality()` then optionally `correct_single_requirement()`
6. For traceability mode: calls `analyze_traceability_from_swe1_with_llm()` then processes orphaned SWE.2s
7. Marks job as completed, resets global rules state

**File Parsing Features:**
- Supports CSV and XLSX formats
- Intelligent header auto-detection with fuzzy matching
- XLSX parsing uses Python's built-in `zipfile` and `xml.etree.ElementTree` (no openpyxl needed at runtime)
- Handles shared strings, rich text, multi-sheet workbooks
- Column mapping: ID → `id`, Content → `text`, additional columns preserved

---

## 6. Frontend Specifications

### 6.1 Angular Application Structure

**Root Component:** `App` (`app.ts`)
- Tab-based navigation: **Dashboard**, **Requirement Analysis**, **RAG Configuration**
- Sticky header with AIRAM logo, navigation tabs, and backend status badge
- WebSocket connection to backend for real-time health monitoring
- Auto-reconnect on disconnect (3-second retry)

### 6.2 API Service

**File:** `frontend/src/app/services/api.service.ts`

**Base URL Resolution:**
- `localhost` → `http://localhost:8000`
- Otherwise → `https://aaram.onrender.com` (deployed instance)

**Methods (20 total):**

| Category | Method | Description |
|---|---|---|
| **Guidelines** | `uploadGuideline()` | Upload JSON guideline file |
| | `getGuidelines()` | List all guidelines |
| | `updateGuideline()` | Update guideline name/content |
| | `deleteGuideline()` | Delete guideline |
| **RAG** | `getRagMetrics()` | Get chunking metrics |
| | `searchRag()` | Manual semantic search |
| | `getRagCollections()` | List Qdrant collections |
| | `inspectPdf()` | Get PDF page count |
| | `trainRAG()` | Start RAG training (SSE via `fetch()` + `ReadableStream`) |
| **Analysis** | `startAnalysis()` | Start analysis job |
| | `pauseAnalysis()` | Pause job |
| | `resumeAnalysis()` | Resume job |
| | `stopAnalysis()` | Stop job |
| | `getAnalysisStatus()` | Poll progress |
| | `getRunResults()` | Get row results |
| | `getHistory()` | List execution history |
| | `minimizeRun()` | Minimize/restore run card |
| | `deleteRun()` | Delete run |

**SSE Streaming Implementation:**
The `trainRAG()` method uses the native `fetch()` API with `ReadableStream` to process Server-Sent Events, since Angular's `HttpClient` does not natively support SSE. The stream is decoded and parsed line-by-line, with each `data:` line emitted as an Observable event.

### 6.3 Dashboard Component

**File:** `frontend/src/app/components/dashboard/dashboard.ts` (35,872 bytes)

**Features:**
- Execution history list with pagination
- Stacked compliance bar charts (PASS/FAIL/REVIEW counts)
- Run cards with status badges, timestamps, and guideline name
- Minimize/restore toggle per run card
- Delete confirmation
- "View Results" navigation to Requirements tab
- "New Execution" button

### 6.4 Requirements Component

**File:** `frontend/src/app/components/requirements/requirements.ts` (59,380 bytes)

**Features:**
- **File Upload:** Drag-and-drop or click-to-browse for SWE.1 and SWE.2 CSV/XLSX files
- **Run Type Selection:** Quality, Traceability, or Combined
- **Guidelines Source:** RAG Engine or Strict Guidelines (with guideline selection dropdown)
- **Model Selection:** Default `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- **Correction Options:** Checkboxes for Quality Correction and Traceability Correction
- **Custom Context:** Free-text areas for custom analysis and correction evaluation criteria
- **Execution Controls:** Start, Pause, Resume, Stop buttons
- **Progress Tracking:** Real-time row-by-row progress with polling
- **Results Table:** Expandable rows showing requirement ID, original text, status badge, failed rules, rationale, and corrected text
- **Category Filtering:** Filter results by SWE.1, SWE.2, or Traceability category
- **History Results Viewer:** Load results from a previous execution run

### 6.5 RAG Configuration Component

**File:** `frontend/src/app/components/rag-config/rag-config.ts` (24,703 bytes)

**Features:**
- **File Upload:** Drag-and-drop for PDF, JSON, CSV, TXT, XLSX files
- **Configuration Dialog:** Pops up after file selection with:
  - Collection mode: Create New or Add to Existing
  - Collection name: text input or dropdown of existing collections
  - PDF page range: start and end page inputs (with PDF page count inspection)
- **Progress Tracking:** Real-time log of chunk processing via SSE stream
- **Chunking Metrics:** Total chunks, total tokens, average tokens per chunk
- **Manual Search:** Query input with collection selector and results display (text + score)

### 6.6 Design System & Styling

**File:** `frontend/src/styles.css`

**Design Language:** Clean minimalist light theme

| Token | Value |
|---|---|
| `--bg-primary` | `#f8fafc` |
| `--bg-card` | `#ffffff` |
| `--text-primary` | `#1e293b` |
| `--text-secondary` | `#64748b` |
| `--color-primary` | `#0052cc` |
| `--color-success` | `#10b981` |
| `--color-warning` | `#f59e0b` |
| `--color-danger` | `#ef4444` |
| `--border-radius` | `8px` |
| **Font** | `Inter` (Google Fonts, 400–800 weights) |

**Component Library (CSS classes):**
- `.card`, `.card-title` — Card containers
- `.btn`, `.btn-primary/secondary/success/danger/warning`, `.btn-sm` — Buttons
- `.badge`, `.badge-pass/fail/review/running/neutral` — Status badges with animated dots
- `.form-group`, `.form-label`, `.form-control` — Form elements
- `.grid`, `.grid-2`, `.grid-3` — Responsive grid layouts
- `.dropzone` — Drag & drop file upload area
- `.table-container`, `table`, `th`, `td` — Data tables
- Custom scrollbar styling

---

## 7. Data Flow & Processing Pipelines

### 7.1 Quality Analysis Pipeline

```
User uploads CSV/XLSX file(s)
         │
         ▼
POST /api/analysis/start (run_type = "quality")
         │
         ▼
analyzer_service.run_requirements_analysis_job()
         │
         ├── Parse CSV/XLSX → list of Requirement objects
         │
         ├── Load guidelines (Strict JSON or skip for RAG mode)
         │
         ├── For each requirement (row-by-row):
         │   │
         │   ├── Check pause/stop status (DB polling)
         │   │
         │   ├── Create "PROCESSING" placeholder in DB
         │   │
         │   ├── [If RAG] Query vector DB for relevant context
         │   │
         │   ├── Call analyze_quality():
         │   │   └── LLM prompt → { status, failed_rules, rationale }
         │   │
         │   ├── [If REVIEW & correct_quality enabled]:
         │   │   └── Call correct_single_requirement()
         │   │       └── LLM prompt → { corrected_requirements }
         │   │
         │   └── Update result row in DB
         │
         └── Mark run as "completed"
```

### 7.2 Traceability Analysis Pipeline

```
User uploads SWE.1 (HLR) + SWE.2 (LLR) files
         │
         ▼
POST /api/analysis/start (run_type = "traceability")
         │
         ▼
analyzer_service.run_requirements_analysis_job()
         │
         ├── Parse both files → SWE.1 + SWE.2 Requirement lists
         │
         ├── For each SWE.1 requirement:
         │   │
         │   ├── Check pause/stop status
         │   │
         │   ├── Create "PROCESSING" placeholder
         │   │
         │   ├── Call analyze_traceability_from_swe1_with_llm():
         │   │   └── LLM evaluates which SWE.2 reqs trace to this SWE.1
         │   │   └── Returns { status, linked_swe2_ids, rationale }
         │   │
         │   ├── Track covered SWE.2 IDs
         │   │
         │   └── Update result row in DB
         │
         ├── For each uncovered SWE.2:
         │   └── Create "FAIL" result with "Orphaned LLD" rationale
         │
         └── Mark run as "completed"
```

### 7.3 RAG Training Pipeline

```
User uploads PDF/JSON/CSV/TXT/XLSX file
         │
         ▼
POST /api/rag/train (SSE streaming)
         │
         ▼
rag_service.train_document_stream()
         │
         ├── Clear previous chunks for this document
         │
         ├── Setup/recreate collection in Qdrant
         │
         ├── RAGEngine.process_file():
         │   ├── [PDF] pymupdf4llm → page chunks → split oversized
         │   ├── [XLSX] pandas → 15-row Markdown table batches
         │   ├── [CSV] DictReader → row chunks
         │   ├── [JSON] pretty-print → paragraph blocks
         │   └── [TXT] paragraph split
         │
         ├── Yield { status: "started" }
         │
         ├── For each chunk:
         │   ├── Generate embedding via NVIDIA API
         │   ├── Save to SQLite (chunks table)
         │   ├── Upsert to Qdrant
         │   └── Yield { status: "processing", chunk: {...} }
         │
         └── Yield { status: "completed", metrics: {...} }
```

---

## 8. File Format Support

### Input Requirements Files

| Format | Extensions | Parser | Header Detection |
|---|---|---|---|
| CSV | `.csv` | `csv.DictReader` | Fuzzy matching on `id`, `text`, `content`, `requirement`, `description`, `covers`, `state`, `asil` |
| Excel | `.xlsx` | `zipfile` + `xml.etree.ElementTree` (built-in) | Same fuzzy matching on headers |

### RAG Training Files

| Format | Extensions | Processing |
|---|---|---|
| PDF | `.pdf` | PyMuPDF + pymupdf4llm, page-level chunks |
| Excel | `.xlsx`, `.xls` | pandas, 15-row Markdown table batches |
| CSV | `.csv` | Row-by-row chunks |
| JSON | `.json` | Paragraph block segmentation |
| Text | `.txt` | Blank-line paragraph segmentation |

### Guidelines Files

| Format | Extensions | Usage |
|---|---|---|
| JSON | `.json` | Strict rule definitions uploaded via Standards Setup |

---

## 9. LLM Prompt Engineering

### Quality Analysis System Prompt (RAG Mode)

```
You are a strict, deterministic Systems Engineering Requirements Auditor.
Your task is to analyze an engineering requirement using INCOSE guidelines and EARS syntax.
You MUST:
- Identify structural components (trigger, condition, system response)
- Evaluate compliance against INCOSE guidelines, EARS syntax

Rules for Output:
1. Return ONLY valid JSON exactly matching the schema below.
2. Do NOT include any explanation or markdown formatting outside the JSON.
3. Do NOT invent information. Output must be perfectly reproducible.

JSON Schema:
{
  "status": "Passed" or "Review",
  "failed_rules": ["Rule name 1", "Rule name 2", ...] or [],
  "rationale": "Concise structured explanation"
}
```

### Quality Analysis System Prompt (Strict JSON Mode)

```
You are a rule evaluation engine. You must ONLY use the provided JSON rules.
Do not use any external knowledge or assumptions.
No external interpretation is allowed.
Do NOT infer missing requirements, enhance rules, or apply software engineering best practices
unless explicitly present in the rules.

Provided JSON Rules:
{...full rules JSON...}

For the requirement under evaluation, check if it satisfies all relevant rules
(status = PASS) or violates any rule (status = FAIL).
```

### Traceability System Prompt

```
You are an automotive safety and systems engineer.
Evaluate which of the following Low-Level Software Requirements (SWE.2) properly trace to
and satisfy the High-Level Requirement (SWE.1) listed below.
Respond ONLY in a structured JSON format containing the following fields:
{
  "status": "PASS" | "FAIL" | "REVIEW",
  "linked_swe2_ids": ["SWE2_0001", "SWE2_0002", ...] or [],
  "rationale": "Reason why they trace or do not trace"
}
```

### Correction System Prompt

```
You are a strict, deterministic Senior Systems Engineer and Requirements Expert.
Your task is to analyze and correct engineering requirements using INCOSE guidelines and EARS syntax.
You MUST adhere to these strict rules:
1. Return ONLY valid JSON exactly matching the schema below.
2. Do NOT include any explanation or markdown formatting outside the JSON.
3. Do NOT invent information. Output must be perfectly reproducible.
4. Split the requirement if it contains multiple actions.

JSON Schema:
{
  "split_required": boolean,
  "corrected_requirements": [string]
}
```

### LLM Configuration

| Parameter | Value | Purpose |
|---|---|---|
| `temperature` | 0.0 | Maximum determinism |
| `top_p` | 0.01 | Extremely focused token sampling |
| `seed` | 42 | Reproducible outputs |
| `max_tokens` | 8192 | Maximum response length |
| `stream` | false | Non-streaming for JSON parsing |

---

## 10. Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NVIDIA_API_KEY` | NVIDIA NIM API key for LLM and embeddings | `nvapi-xxxxx` |
| `QDRANT_URL` | Qdrant Cloud instance URL | `https://xxx.cloud.qdrant.io` |
| `QDRANT_API_KEY` | Qdrant API key (JWT) | `eyJhbGci...` |

### Configuration File Location

- Backend: `backend/.env`

---

## 11. External Dependencies

### Python (backend/requirements.txt)

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `openai` | OpenAI-compatible API client for NVIDIA NIM |
| `numpy` | Vector math for local cosine similarity fallback |
| `qdrant-client` | Qdrant vector database client |
| `python-dotenv` | Environment variable loading |
| `pandas` | Excel/DataFrame processing |
| `openpyxl` | Excel file engine for pandas |
| `pymupdf` | PDF processing (PyMuPDF / fitz) |
| `pymupdf4llm` | Layout-aware PDF to Markdown conversion |
| `python-multipart` | Multipart form data parsing for file uploads |
| `websockets` | WebSocket support |

### Node.js (frontend/package.json)

| Package | Purpose |
|---|---|
| `@angular/core` (v22) | Angular framework |
| `@angular/common` (v22) | Common utilities |
| `@angular/compiler` (v22) | Template compiler |
| `@angular/forms` (v22) | Forms module |
| `@angular/platform-browser` (v22) | Browser platform |
| `@angular/router` (v22) | Client-side routing |
| `rxjs` (v7.8) | Reactive programming |
| `zone.js` (v0.16) | Angular change detection |
| `typescript` (v6.0) | TypeScript compiler |

---

## 12. Testing

### Integration Test Suite

**File:** `backend/test_backend.py`

**Test Cases:**

| # | Test | Description |
|---|---|---|
| 1 | Database Initialization | Calls `init_db()` and verifies success |
| 2 | RAG Progressive Training | Trains a small JSON rules file, verifies SSE stream yields `started` and `completed` states with ≥ 2 events |
| 3 | Similarity Search | Queries `"modal verb"` against trained chunks, verifies ≥ 1 result with score and text |
| 4 | Requirements Analysis Job | Runs a full traceability analysis with mock HLR/LLR CSV data, tests pause/resume flow, verifies job completion and result storage |

**Run:**
```bash
cd backend
python test_backend.py
```

---

## 13. Deployment Modes

### Local Development

| Component | Command | URL |
|---|---|---|
| Backend | `cd backend && python main.py` | `http://localhost:8000` |
| Frontend | `cd frontend && npm start` | `http://localhost:4200` |

### Cloud Deployment

The frontend `ApiService` includes automatic base URL detection:
- When running on `localhost`, it connects to `http://localhost:8000`
- Otherwise, it connects to `https://aaram.onrender.com` (Render deployment)

### Prerequisites

| Requirement | Minimum Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18.x+ |
| npm | 11.x+ |

---

## Appendix: Artefact Rule Files

The `artefacts/rules/` directory contains pre-built strict guideline JSON files:

| File | Description |
|---|---|
| `rules_42.json` (37 KB) | Comprehensive 42-rule ruleset |
| `rules_ears_all_25_with_category.json` (26 KB) | 25 EARS rules with category metadata |
| `rules_ears_canonical_16.json` (18 KB) | 16 canonical EARS syntax rules |

These can be uploaded via the Standards Setup tab and selected during analysis in Strict Guidelines mode.
