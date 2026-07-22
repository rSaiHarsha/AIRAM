import os
import sys
import uuid
import json
import asyncio
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Ensure backend directory is in python path to support Model, Analysis, RagEngine imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)
sys.path.append(os.path.dirname(backend_dir))

# Load environment variables
load_dotenv(os.path.join(backend_dir, ".env"))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from backend.database import (
    init_db,
    save_guidelines,
    get_all_guidelines,
    update_guideline,
    delete_guideline,
    get_previous_executions,
    get_execution_results,
    update_execution_minimized,
    update_execution_status,
    get_chunking_metrics,
    delete_execution_run,
    get_execution_run,
    create_project,
    get_all_projects,
    get_project_by_id,
    save_project_requirements,
    get_project_requirements_from_db,
    delete_project,
    trigger_render_sync
)
from pydantic import BaseModel
from backend.rag_service import train_document_stream, search_guideline_chunks, delete_rag_collection
from backend.analyzer_service import run_requirements_analysis_job, ACTIVE_JOBS
from backend.file_parser import parse_requirements_file

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="AIRAM Backend", lifespan=lifespan)

# Enable CORS for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development compatibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/api/ws/status")
async def websocket_status(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass

@app.post("/api/guidelines/upload")
async def upload_guidelines(
    name: str = Form(...),
    file: UploadFile = File(...)
):
    """Uploads rules guidelines (like INCOSE, ASPICE) in JSON format."""
    try:
        content = await file.read()
        parsed_json = json.loads(content.decode("utf-8-sig"))
        guideline_id = str(uuid.uuid4())
        save_guidelines(guideline_id, name, parsed_json)
        return {"status": "success", "id": guideline_id, "name": name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file structure: {str(e)}")

@app.get("/api/guidelines")
async def get_guidelines():
    """Lists all available strict guideline documents."""
    return get_all_guidelines()

class GuidelineUpdate(BaseModel):
    name: str
    content: str

@app.put("/api/guidelines/{guideline_id}")
async def edit_guideline(guideline_id: str, payload: GuidelineUpdate):
    """Updates a strict guideline document."""
    try:
        parsed_json = json.loads(payload.content)
        update_guideline(guideline_id, payload.name, parsed_json)
        return {"status": "success", "id": guideline_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON content: {str(e)}")

@app.delete("/api/guidelines/{guideline_id}")
async def remove_guideline(guideline_id: str):
    """Deletes a strict guideline document."""
    delete_guideline(guideline_id)
    return {"status": "success", "id": guideline_id}

@app.post("/api/rag/train")
async def train_rag(
    file: UploadFile = File(...),
    collection_name: str = Form("requalitrace_guidelines"),
    collection_mode: str = Form("create"),
    start_page: str = Form(None),
    end_page: str = Form(None)
):
    """
    Progressively processes and chunks a guideline file,
    streaming chunk logs and chunking metrics to the frontend in real time.
    """
    filename = file.filename
    content = await file.read()
    
    s_page = int(start_page) if start_page and start_page.strip().isdigit() else None
    e_page = int(end_page) if end_page and end_page.strip().isdigit() else None
    
    async def sse_generator():
        for state in train_document_stream(
            content, 
            filename, 
            collection_name=collection_name,
            collection_mode=collection_mode,
            start_page=s_page,
            end_page=e_page
        ):
            yield f"data: {json.dumps(state)}\n\n"
            await asyncio.sleep(0.01) # Yield thread
        # Sync to Render after chunking finishes
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/api/rag/inspect-pdf")
async def inspect_pdf(file: UploadFile = File(...)):
    """Inspects an uploaded PDF and returns its page count."""
    try:
        content = await file.read()
        try:
            import fitz
        except ImportError:
            import pymupdf as fitz
        doc = fitz.open(stream=content, filetype="pdf")
        return {"pages": len(doc)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to inspect PDF: {str(e)}")

@app.get("/api/rag/collections")
async def get_rag_collections():
    """Lists all active RAG vector database collections."""
    from backend.rag_service import rag_engine
    return rag_engine.get_collections()

@app.get("/api/rag/metrics")
async def get_rag_metrics():
    """Retrieves current vector DB chunking metrics, including Qdrant collection stats."""
    metrics = get_chunking_metrics()
    
    # Enrich with live Qdrant collection data
    from backend.rag_service import rag_engine
    try:
        collections = rag_engine.get_collections()
        metrics["total_collections"] = len(collections)
        
        # Get per-collection chunk counts from Qdrant
        total_qdrant_chunks = 0
        collection_details = []
        if rag_engine.qdrant_client:
            for col_name in collections:
                try:
                    col_info = rag_engine.qdrant_client.get_collection(col_name)
                    point_count = col_info.points_count or 0
                    total_qdrant_chunks += point_count
                    collection_details.append({
                        "name": col_name,
                        "chunks": point_count
                    })
                except Exception:
                    collection_details.append({
                        "name": col_name,
                        "chunks": 0
                    })
        
        # Use Qdrant chunk count if SQLite shows 0 but Qdrant has data
        if metrics["total_chunks"] == 0 and total_qdrant_chunks > 0:
            metrics["total_chunks"] = total_qdrant_chunks
        
        metrics["collections"] = collection_details
    except Exception as e:
        metrics["total_collections"] = 0
        metrics["collections"] = []
    
    return metrics

@app.get("/api/rag/search")
async def search_rag(query: str, limit: int = 5, collection_name: str = "requalitrace_guidelines"):
    """Search endpoint to manually evaluate chunking and relevance retrieval."""
    return search_guideline_chunks(query, limit, collection_name)

@app.delete("/api/rag/collections/{collection_name}")
async def remove_rag_collection(collection_name: str):
    """Deletes a RAG vector database collection."""
    delete_rag_collection(collection_name)
    trigger_render_sync()
    return {"status": "success", "collection_name": collection_name}

@app.post("/api/projects")
async def add_project(
    name: str = Form(...),
    description: str = Form(""),
    swe1_file: UploadFile = File(...),
    swe2_file: UploadFile = File(None)
):
    project_id = str(uuid.uuid4())
    create_project(project_id, name, description)
    
    swe1_content = await swe1_file.read()
    swe1_reqs = parse_requirements_file(swe1_content, swe1_file.filename)
    if swe1_reqs:
        save_project_requirements(project_id, swe1_reqs, "swe1")
        
    if swe2_file:
        swe2_content = await swe2_file.read()
        swe2_reqs = parse_requirements_file(swe2_content, swe2_file.filename)
        if swe2_reqs:
            save_project_requirements(project_id, swe2_reqs, "swe2")
            
    return {"status": "success", "project_id": project_id}

@app.get("/api/projects")
async def list_projects():
    return get_all_projects()

@app.delete("/api/projects/{project_id}")
async def remove_project(project_id: str):
    """Deletes a project and its requirements from the database."""
    delete_project(project_id)
    trigger_render_sync()
    return {"status": "success", "project_id": project_id}

@app.get("/api/projects/{project_id}/requirements")
async def get_project_reqs(project_id: str):
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    swe1_reqs = get_project_requirements_from_db(project_id, "swe1")
    swe2_reqs = get_project_requirements_from_db(project_id, "swe2")
    
    # Fetch latest execution run
    from backend.database import get_latest_execution_run_for_project, get_execution_results
    latest_run = get_latest_execution_run_for_project(project["name"])
    run_results = {}
    if latest_run:
        results = get_execution_results(latest_run["run_id"])
        for r in results:
            run_results[r["req_id"]] = r
            
    def build_req_dict(reqs):
        out = []
        for r in reqs:
            req_id = r.get("id", r.get("name"))
            d = {"id": req_id, "text": r.get("text", r.get("content"))}
            if req_id in run_results:
                d["analysis"] = run_results[req_id]
            out.append(d)
        return out
            
    return {
        "swe1": build_req_dict(swe1_reqs),
        "swe2": build_req_dict(swe2_reqs)
    }

@app.post("/api/analysis/start")
async def start_analysis(
    run_type: str = Form(...), # 'quality', 'traceability', 'combined'
    project_id: str = Form(...),
    guideline_id: str = Form(None),
    use_rag: str = Form("false"),
    model_name: str = Form("nvidia/llama-3.3-nemotron-super-49b-v1.5"),
    correct_quality: str = Form("false"),
    correct_trace: str = Form("false"),
    custom_context: str = Form(None),
    custom_context_correction: str = Form(None)
):
    """Spawns an async row-by-row requirements analysis or traceability evaluation run."""
    run_id = str(uuid.uuid4())
    
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    swe1_reqs_raw = get_project_requirements_from_db(project_id, "swe1")
    swe2_reqs_raw = get_project_requirements_from_db(project_id, "swe2")
    
    use_rag_bool = use_rag.lower() == "true"
    correct_quality_bool = correct_quality.lower() == "true"
    correct_trace_bool = correct_trace.lower() == "true"
    
    # Run the job in the background
    asyncio.create_task(
        run_requirements_analysis_job(
            run_id=run_id,
            run_type=run_type,
            swe1_reqs_raw=swe1_reqs_raw,
            swe2_reqs_raw=swe2_reqs_raw,
            guideline_id=guideline_id,
            project_name=project.get("name"),
            use_rag=use_rag_bool,
            model_name=model_name,
            correct_quality=correct_quality_bool,
            correct_trace=correct_trace_bool,
            custom_context=custom_context,
            custom_context_correction=custom_context_correction
        )
    )
    
    return {"status": "started", "run_id": run_id}

@app.post("/api/analysis/{run_id}/pause")
async def pause_analysis(run_id: str):
    if run_id in ACTIVE_JOBS:
        ACTIVE_JOBS[run_id]["status"] = "paused"
        update_execution_status(run_id, "paused")
        return {"status": "paused", "run_id": run_id}
    raise HTTPException(status_code=404, detail="Execution run not found or inactive")

@app.post("/api/analysis/{run_id}/resume")
async def resume_analysis(run_id: str):
    if run_id in ACTIVE_JOBS:
        ACTIVE_JOBS[run_id]["status"] = "running"
        update_execution_status(run_id, "running")
        return {"status": "running", "run_id": run_id}
    raise HTTPException(status_code=404, detail="Execution run not found or inactive")

@app.post("/api/analysis/{run_id}/stop")
async def stop_analysis(run_id: str):
    if run_id in ACTIVE_JOBS:
        ACTIVE_JOBS[run_id]["status"] = "stopped"
        update_execution_status(run_id, "stopped")
        return {"status": "stopped", "run_id": run_id}
    raise HTTPException(status_code=404, detail="Execution run not found or inactive")

@app.get("/api/analysis/{run_id}/status")
async def get_analysis_status(run_id: str):
    """Gets running/active progress details of a job from the database."""
    run_details = get_execution_run(run_id)
    if run_details:
        return {
            "status": run_details["status"],
            "current_row": run_details["current_row"],
            "total_rows": run_details["total_rows"]
        }
    return {"status": "inactive"}

@app.get("/api/analysis/{run_id}/results")
async def get_run_results(run_id: str):
    """Retrieves all parsed requirements and analysis row results for the run."""
    return get_execution_results(run_id)

@app.get("/api/analysis/history")
async def get_history(limit: int = 15, offset: int = 0):
    """Lists previous execution summaries, supporting the dashboard metrics and minimizations."""
    return get_previous_executions(limit, offset)

@app.post("/api/analysis/{run_id}/minimize")
async def minimize_run(run_id: str, minimized: bool = Form(...)):
    """Minimizes/restores a run card on the frontend history section."""
    val = 1 if minimized else 0
    update_execution_minimized(run_id, val)
    return {"status": "success", "run_id": run_id, "minimized": minimized}

@app.delete("/api/analysis/{run_id}")
async def delete_run(run_id: str):
    """Deletes an execution run history and its results from the database."""
    delete_execution_run(run_id)
    return {"status": "success", "run_id": run_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
