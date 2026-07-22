# AIRAM - AI-Assisted Requirement Analysis & Management ✦

AIRAM is an agentic automotive requirements analysis and compliance validation tool. It provides:
1. **Requirements Compliance & Quality Auditor**: Evaluates software requirements (such as SWE.1 HLR or SWE.2 LLR) against strict guidelines (e.g. INCOSE, ASPICE rules) using LLMs and gives audit statuses (PASS / REVIEW) along with suggested rewrites if violations are found.
2. **Requirements Traceability Analyzer**: Evaluates tracing compliance between Low-Level Software Requirements (SWE.2) and High-Level System Requirements (SWE.1) with automated orphan LLD rewriting.
3. **Workspace Project Management**: Provides workspace containers to store SWE.1/SWE.2 requirements datasets persistently in SQLite and manage multi-project validation lifecycles.
4. **RAG (Retrieval-Augmented Generation) Ingestion**: Supports progressive database segmenting and indexing of guidelines documents (such as PDF files, Excel lists, CSVs, TXTs) using layout-aware extraction with page-range controls and Qdrant Cloud vector database integration.
5. **Manual Retrieval Querying**: Lets you verify semantic Qdrant retrieval scores across dynamic custom guideline collections.
6. **Interactive Dashboard**: Visualizes execution history runs, stacked compliance statistics, and Qdrant chunking metrics with WebSocket health monitoring.

---

## Prerequisites

Before running the application, make sure you have the following installed on your machine:
* **Python**: Version 3.10 or higher
* **Node.js**: Version 18.x or higher, along with **npm** (Node Package Manager)

---

## 1. Backend Setup (FastAPI)

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   - **On Windows (PowerShell/Cmd)**:
     ```powershell
     python -m venv myenv
     .\myenv\Scripts\activate
     ```
   - **On macOS/Linux**:
     ```bash
     source myenv/bin/activate
     ```

3. Install the required python libraries:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables Configuration**:
   Create a `.env` file in the `backend/` directory and configure the following variables:
   ```env
   # Qdrant Vector Store credentials (Cloud or Local instance)
   QDRANT_URL=https://your-qdrant-url-here.cloud.qdrant.io
   QDRANT_API_KEY=your-qdrant-api-key-here

   # LLM Model Access (NVIDIA NIM or OpenAI compatible base URL)
   NVIDIA_API_KEY=nvapi-your-nvidia-nim-api-key-here
   ```

5. Launch the FastAPI server:
   ```bash
   python main.py
   ```
   The backend server will launch at `http://localhost:8000` and automatically watch for code changes.

---

## 2. Frontend Setup (Angular)

1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```

2. Install the frontend npm node packages:
   ```bash
   npm install
   ```

3. Start the Angular development server:
   ```bash
   npm start
   ```
   The development server will run at `http://localhost:4200/`. Open this URL in your browser to interact with the application.

---

## 3. How to Use the Studio

### Workspace Project Setup
1. Go to the **Projects** tab.
2. Click **+ New Project** to open the creation modal.
3. Enter your Project Name, Description, and upload your **SWE.1 (HLR)** and **SWE.2 (LLR)** CSV or XLSX files.
4. Your requirements are automatically parsed, normalized, and saved to the SQLite workspace database.

### Requirement Validation & Traceability
1. Go to the **Requirement Analysis** tab.
2. Select your active project from the **Project** dropdown.
3. Select whether to use the **RAG Engine** (semantic search over vector DB) or **Strict Guidelines** (JSON rule files uploaded via Standards Setup).
4. Configure analysis options (Quality Analysis, Quality Correction, Traceability Analysis, Traceability Correction) using the checkboxes.
5. Click **Start Execution** to run validation row-by-row with live progress tracking, pause/resume/stop control, and full rationale outputs.

### Progressive RAG Training
1. Go to the **RAG Configuration** tab.
2. Choose a PDF, JSON, CSV, XLSX, or TXT guideline document to upload.
3. The configuration dialog will pop up automatically. Configure your **Target Collection** (Create New or Add to Existing) and **PDF Page Range** (e.g. pages 1 to 5).
4. Confirm and watch the logs list chunking progress and progressive vector commits in real time.
5. Use the **Manual Retrieval Evaluation** search box at the bottom to verify semantic query relevance scores inside your target collection.

