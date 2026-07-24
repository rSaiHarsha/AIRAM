import os
import sqlite3
import json

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "airam.db")
OLD_DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "requalitrace.db")

IS_POSTGRES = bool(os.environ.get("DATABASE_URL"))
if IS_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
else:
    # Automatically migrate database if old one exists
    if not os.path.exists(DATABASE_PATH) and os.path.exists(OLD_DATABASE_PATH):
        try:
            import shutil
            shutil.copy2(OLD_DATABASE_PATH, DATABASE_PATH)
            print(f"[database] Migrated old database to {DATABASE_PATH}")
        except Exception as e:
            print(f"[database] Failed to migrate database: {e}")

class CursorWrapper:
    def __init__(self, cursor, is_postgres):
        self._cursor = cursor
        self.is_postgres = is_postgres

    def execute(self, query, params=()):
        if self.is_postgres:
            query = query.replace("?", "%s")
        self._cursor.execute(query, params)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return None if self.is_postgres else self._cursor.lastrowid

class ConnectionWrapper:
    def __init__(self, conn, is_postgres):
        self._conn = conn
        self.is_postgres = is_postgres

    def cursor(self):
        if self.is_postgres:
            cur = self._conn.cursor(cursor_factory=RealDictCursor)
        else:
            cur = self._conn.cursor()
        return CursorWrapper(cur, self.is_postgres)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()
        
    def execute(self, query, params=()):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

def format_iso_timestamp(val):
    if not val:
        return val
    if isinstance(val, str):
        if not val.endswith("Z"):
            return val.replace(" ", "T") + "Z"
        return val
    if hasattr(val, "isoformat"):
        iso_str = val.isoformat()
        if not iso_str.endswith("Z"):
            return iso_str + "Z"
        return iso_str
    return str(val)

def get_connection():
    if IS_POSTGRES:
        db_url = os.environ.get("DATABASE_URL", "")
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        if "sslmode" not in db_url:
            db_url += "?sslmode=require" if "?" not in db_url else "&sslmode=require"
        conn = psycopg2.connect(db_url)
        return ConnectionWrapper(conn, True)
    else:
        conn = sqlite3.connect(DATABASE_PATH, timeout=20.0)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        return ConnectionWrapper(conn, False)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    auto_inc = "SERIAL" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    
    # Guidelines Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS guidelines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Chunks Table for progressive loading & metrics
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS chunks (
            id {auto_inc},
            doc_name TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            qdrant_id TEXT,
            embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Execution Runs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_runs (
            run_id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type TEXT NOT NULL, -- 'quality', 'traceability', 'combined'
            status TEXT NOT NULL, -- 'running', 'paused', 'stopped', 'completed'
            minimized INTEGER DEFAULT 0, -- 0 = normal, 1 = minimized
            current_row INTEGER DEFAULT 0,
            total_rows INTEGER DEFAULT 0,
            guideline_name TEXT,
            project_name TEXT
        )
    """)
    add_col = "ADD COLUMN IF NOT EXISTS" if IS_POSTGRES else "ADD COLUMN"
    try:
        cursor.execute(f"ALTER TABLE execution_runs {add_col} current_row INTEGER DEFAULT 0")
    except Exception:
        conn.rollback()
    try:
        cursor.execute(f"ALTER TABLE execution_runs {add_col} total_rows INTEGER DEFAULT 0")
    except Exception:
        conn.rollback()
    try:
        cursor.execute(f"ALTER TABLE execution_runs {add_col} guideline_name TEXT")
    except Exception:
        conn.rollback()
    try:
        cursor.execute(f"ALTER TABLE execution_runs {add_col} project_name TEXT")
    except Exception:
        conn.rollback()
        
    # Migrate old execution runs to have a default project name
    cursor.execute("UPDATE execution_runs SET project_name = 'old tests' WHERE project_name IS NULL")
    
    # Execution Results Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS execution_results (
            id {auto_inc},
            run_id TEXT NOT NULL,
            req_id TEXT,
            input_req TEXT,
            status TEXT NOT NULL, -- 'PASS', 'FAIL', 'REVIEW'
            failed_rule TEXT,
            rationale TEXT,
            corrected_req TEXT,
            swe1_id TEXT, -- populated for SWE.2 traceability
            swe1_text TEXT, -- populated for SWE.2 traceability
            category TEXT, -- 'swe1', 'swe2', 'traceability'
            FOREIGN KEY (run_id) REFERENCES execution_runs(run_id)
        )
    """)
    
    # Safely migrate existing databases
    try:
        cursor.execute(f"ALTER TABLE execution_results {add_col} swe1_text TEXT")
    except Exception:
        conn.rollback()
    try:
        cursor.execute(f"ALTER TABLE execution_results {add_col} category TEXT")
    except Exception:
        conn.rollback()
        
    # Migrate old categories
    cursor.execute("UPDATE execution_results SET category = 'swe1' WHERE category = 'sys1'")
    cursor.execute("UPDATE execution_results SET category = 'swe2' WHERE category = 'sys2'")
    
    # Projects Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Project Requirements Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS project_requirements (
            id {auto_inc},
            project_id TEXT NOT NULL,
            req_id TEXT NOT NULL,
            content TEXT NOT NULL,
            req_type TEXT NOT NULL, -- 'sys1', 'sys2', 'sys3', 'swe1', or 'swe2'
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()

# Helper accessors
def save_guidelines(guideline_id: str, name: str, data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    if IS_POSTGRES:
        cursor.execute(
            "INSERT INTO guidelines (id, name, content) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, content = EXCLUDED.content",
            (guideline_id, name, json.dumps(data))
        )
    else:
        cursor.execute(
            "INSERT OR REPLACE INTO guidelines (id, name, content) VALUES (?, ?, ?)",
            (guideline_id, name, json.dumps(data))
        )
    conn.commit()
    conn.close()

def get_all_guidelines():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at, content FROM guidelines")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        d = dict(r)
        if "created_at" in d and d["created_at"]:
            d["created_at"] = format_iso_timestamp(d["created_at"])
        if d.get("content"):
            d['content'] = json.loads(d['content']) if isinstance(d['content'], str) else d['content']
        else:
            d['content'] = {}
        result.append(d)
    return result

def get_guideline_content(guideline_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM guidelines WHERE id = ?", (guideline_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    content_val = row["content"]
    return json.loads(content_val) if isinstance(content_val, str) else content_val

def get_guideline_details(guideline_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, content FROM guidelines WHERE id = ?", (guideline_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        content_val = row["content"]
        return {
            "id": row["id"],
            "name": row["name"],
            "content": json.loads(content_val) if isinstance(content_val, str) else content_val
        }
    return None

def update_guideline(guideline_id: str, new_name: str, new_content: dict):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE guidelines SET name = ?, content = ? WHERE id = ?",
        (new_name, json.dumps(new_content), guideline_id)
    )
    conn.commit()
    conn.close()

def delete_guideline(guideline_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM guidelines WHERE id = ?", (guideline_id,))
    conn.commit()
    conn.close()

def save_chunk_log(doc_name: str, chunk_index: int, text: str, tokens: int, qdrant_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chunks (doc_name, chunk_index, chunk_text, token_count, qdrant_id) VALUES (?, ?, ?, ?, ?)",
        (doc_name, chunk_index, text, tokens, qdrant_id)
    )
    conn.commit()
    conn.close()

def clear_chunks_for_doc(doc_name: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chunks WHERE doc_name = ?", (doc_name,))
    conn.commit()
    conn.close()

def get_chunking_metrics():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total_chunks, SUM(token_count) as total_tokens, AVG(token_count) as avg_tokens FROM chunks")
    row = cursor.fetchone()
    conn.close()
    if row and row["total_chunks"] and int(row["total_chunks"]) > 0:
        return {
            "total_chunks": int(row["total_chunks"]),
            "total_tokens": int(row["total_tokens"] or 0),
            "avg_tokens": round(float(row["avg_tokens"] or 0), 1)
        }
    return {"total_chunks": 0, "total_tokens": 0, "avg_tokens": 0}

def save_execution_run(run_id: str, run_type: str, status: str, guideline_name: str = None, project_name: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    if IS_POSTGRES:
        cursor.execute(
            "INSERT INTO execution_runs (run_id, type, status, guideline_name, project_name) VALUES (?, ?, ?, ?, ?) ON CONFLICT (run_id) DO UPDATE SET type = EXCLUDED.type, status = EXCLUDED.status, guideline_name = EXCLUDED.guideline_name, project_name = EXCLUDED.project_name",
            (run_id, run_type, status, guideline_name, project_name)
        )
    else:
        cursor.execute(
            "INSERT OR REPLACE INTO execution_runs (run_id, type, status, guideline_name, project_name) VALUES (?, ?, ?, ?, ?)",
            (run_id, run_type, status, guideline_name, project_name)
        )
    conn.commit()
    conn.close()

def update_execution_status(run_id: str, status: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE execution_runs SET status = ? WHERE run_id = ?", (status, run_id))
    conn.commit()
    conn.close()

def update_execution_progress(run_id: str, current_row: int, total_rows: int, status: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute(
            "UPDATE execution_runs SET current_row = ?, total_rows = ?, status = ? WHERE run_id = ?",
            (current_row, total_rows, status, run_id)
        )
    else:
        cursor.execute(
            "UPDATE execution_runs SET current_row = ?, total_rows = ? WHERE run_id = ?",
            (current_row, total_rows, run_id)
        )
    conn.commit()
    conn.close()

def get_execution_run(run_id: str) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM execution_runs WHERE run_id = ?", (run_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        row_dict = dict(row)
        if "timestamp" in row_dict and row_dict["timestamp"]:
            row_dict["timestamp"] = format_iso_timestamp(row_dict["timestamp"])
        return {
            "run_id": row_dict["run_id"],
            "timestamp": row_dict["timestamp"],
            "type": row_dict["type"],
            "status": row_dict["status"],
            "minimized": row_dict["minimized"],
            "current_row": row_dict["current_row"],
            "total_rows": row_dict["total_rows"],
            "guideline_name": row_dict.get("guideline_name")
        }
    return None

def get_execution_status(run_id: str) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM execution_runs WHERE run_id = ?", (run_id,))
    row = cursor.fetchone()
    conn.close()
    return row["status"] if row else None

def update_execution_minimized(run_id: str, minimized: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE execution_runs SET minimized = ? WHERE run_id = ?", (minimized, run_id))
    conn.commit()
    conn.close()

def save_execution_result(run_id: str, req_id: str, input_req: str, status: str, failed_rule: str, rationale: str, corrected_req: str, swe1_id: str = None, swe1_text: str = None, category: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO execution_results (run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id, swe1_text, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id, swe1_text, category)
    )
    conn.commit()
    conn.close()

def create_placeholder_result(run_id: str, req_id: str, input_req: str, category: str = None) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    if IS_POSTGRES:
        cursor.execute(
            "INSERT INTO execution_results (run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id, swe1_text, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
            (run_id, req_id, input_req, "PROCESSING", None, "Analyzing requirement... waiting for LLM response", None, None, None, category)
        )
        last_id = cursor.fetchone()["id"]
    else:
        cursor.execute(
            "INSERT INTO execution_results (run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id, swe1_text, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (run_id, req_id, input_req, "PROCESSING", None, "Analyzing requirement... waiting for LLM response", None, None, None, category)
        )
        last_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return last_id

def update_execution_result_by_id(
    row_id: int, 
    status: str, 
    failed_rule: str, 
    rationale: str, 
    corrected_req: str, 
    swe1_id: str = None, 
    swe1_text: str = None,
    req_id: str = None,
    input_req: str = None,
    category: str = None
):
    conn = get_connection()
    cursor = conn.cursor()
    
    params = [status, failed_rule, rationale, corrected_req, swe1_id, swe1_text]
    sql = "UPDATE execution_results SET status = ?, failed_rule = ?, rationale = ?, corrected_req = ?, swe1_id = ?, swe1_text = ?"
    
    if req_id is not None:
        sql += ", req_id = ?"
        params.append(req_id)
    if input_req is not None:
        sql += ", input_req = ?"
        params.append(input_req)
    if category is not None:
        sql += ", category = ?"
        params.append(category)
        
    sql += " WHERE id = ?"
    params.append(row_id)
    
    cursor.execute(sql, tuple(params))
    conn.commit()
    conn.close()

def get_previous_executions(limit: int = 10, offset: int = 0):
    conn = get_connection()
    cursor = conn.cursor()
    # Fetch execution runs with a summary count of pass, fail, review, and corrections
    cursor.execute(f"""
        SELECT 
            r.run_id, r.timestamp, r.type, r.status, r.minimized, r.guideline_name, r.project_name,
            SUM(CASE WHEN s.status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
            SUM(CASE WHEN s.status = 'FAIL' THEN 1 ELSE 0 END) as fail_count,
            SUM(CASE WHEN s.status = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
            SUM(CASE WHEN s.corrected_req IS NOT NULL AND s.corrected_req != '' THEN 1 ELSE 0 END) as correction_count,
            COUNT(s.id) as total_count
        FROM execution_runs r
        LEFT JOIN execution_results s ON r.run_id = s.run_id
        GROUP BY r.run_id
        ORDER BY r.timestamp DESC
        LIMIT {limit} OFFSET {offset}
    """)
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        row_dict = dict(r)
        if "timestamp" in row_dict and row_dict["timestamp"]:
            row_dict["timestamp"] = format_iso_timestamp(row_dict["timestamp"])
            
        t = (row_dict.get("type") or "").lower()
        has_corrections = (row_dict.get("correction_count", 0) or 0) > 0
        if t == "quality":
            row_dict["type"] = "quality_correction" if has_corrections else "quality_analysis"
        elif t == "traceability":
            row_dict["type"] = "traceability_correction" if has_corrections else "traceability_analysis"
            
        results.append(row_dict)
    return results

def get_execution_results(run_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM execution_results WHERE run_id = ? ORDER BY id ASC", (run_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_execution_run(run_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM execution_results WHERE run_id = ?", (run_id,))
    cursor.execute("DELETE FROM execution_runs WHERE run_id = ?", (run_id,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DATABASE_PATH)

# Project Helpers
def get_latest_execution_run_for_project(project_name: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT run_id, status FROM execution_runs 
        WHERE project_name = ? 
        ORDER BY timestamp DESC LIMIT 1
    """, (project_name,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def create_project(project_id: str, name: str, description: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO projects (id, name, description) VALUES (?, ?, ?)",
        (project_id, name, description)
    )
    conn.commit()
    conn.close()

def save_project_requirements(project_id: str, requirements_list: list, req_type: str):
    conn = get_connection()
    cursor = conn.cursor()
    for req in requirements_list:
        req_id = req.get("id") or "UNKNOWN"
        content_json = json.dumps(req)
        cursor.execute(
            "INSERT INTO project_requirements (project_id, req_id, content, req_type) VALUES (?, ?, ?, ?)",
            (project_id, req_id, content_json, req_type)
        )
    conn.commit()
    conn.close()

def append_project_requirements(project_id: str, requirements_list: list, req_type: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get existing req_ids for this project and type to prevent duplicates
    cursor.execute(
        "SELECT req_id FROM project_requirements WHERE project_id = ? AND req_type = ?",
        (project_id, req_type)
    )
    existing_req_ids = {row['req_id'] for row in cursor.fetchall()}
    
    appended_count = 0
    for req in requirements_list:
        req_id = req.get("id") or "UNKNOWN"
        if req_id in existing_req_ids:
            continue
            
        content_json = json.dumps(req)
        cursor.execute(
            "INSERT INTO project_requirements (project_id, req_id, content, req_type) VALUES (?, ?, ?, ?)",
            (project_id, req_id, content_json, req_type)
        )
        appended_count += 1
        
    conn.commit()
    conn.close()
    return appended_count

def update_project_requirement(project_id: str, req_type: str, req_id: str, new_text: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, content FROM project_requirements WHERE project_id = ? AND req_type = ? AND req_id = ?",
        (project_id, req_type, req_id)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    content_obj = json.loads(row["content"])
    content_obj["text"] = new_text
    
    cursor.execute(
        "UPDATE project_requirements SET content = ? WHERE id = ?",
        (json.dumps(content_obj), row["id"])
    )
    conn.commit()
    conn.close()
    return True

def delete_project_requirements(project_id: str, req_type: str, req_ids: list[str]):
    if not req_ids:
        return 0
    conn = get_connection()
    cursor = conn.cursor()
    placeholders = ",".join(["?"] * len(req_ids))
    query = f"DELETE FROM project_requirements WHERE project_id = ? AND req_type = ? AND req_id IN ({placeholders})"
    cursor.execute(query, [project_id, req_type] + req_ids)
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def get_project_requirements_from_db(project_id: str, req_type: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT content FROM project_requirements WHERE project_id = ? AND req_type = ? ORDER BY id ASC",
        (project_id, req_type)
    )
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        content_val = r["content"]
        if isinstance(content_val, str):
            results.append(json.loads(content_val))
        else:
            results.append(content_val)
    return results

def get_all_projects():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        row_dict = dict(r)
        if "created_at" in row_dict and row_dict["created_at"]:
            row_dict["created_at"] = format_iso_timestamp(row_dict["created_at"])
        results.append(row_dict)
    return results

def get_project_by_id(project_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        row_dict = dict(row)
        if "created_at" in row_dict and row_dict["created_at"]:
            row_dict["created_at"] = format_iso_timestamp(row_dict["created_at"])
        return row_dict
    return None

def delete_project(project_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Fetch project name to delete associated execution runs & results
    cursor.execute("SELECT name FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    project_name = row["name"] if row else None

    if project_name:
        cursor.execute("SELECT run_id FROM execution_runs WHERE project_name = ?", (project_name,))
        runs = cursor.fetchall()
        for r in runs:
            run_id = r["run_id"]
            cursor.execute("DELETE FROM execution_results WHERE run_id = ?", (run_id,))
        cursor.execute("DELETE FROM execution_runs WHERE project_name = ?", (project_name,))

    cursor.execute("DELETE FROM project_requirements WHERE project_id = ?", (project_id,))
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()

def update_project(project_id: str, name: str, description: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Fetch old project name to update execution_runs if project name changes
    cursor.execute("SELECT name FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    old_name = row["name"] if row else None
    
    cursor.execute(
        "UPDATE projects SET name = ?, description = ? WHERE id = ?",
        (name, description, project_id)
    )
    
    if old_name and old_name != name:
        cursor.execute(
            "UPDATE execution_runs SET project_name = ? WHERE project_name = ?",
            (name, old_name)
        )
        
    conn.commit()
    conn.close()
    trigger_render_sync()

def trigger_render_sync():
    try:
        from backend.database_render import sync_sqlite_to_postgres
        import threading
        threading.Thread(target=sync_sqlite_to_postgres, daemon=True).start()
    except Exception:
        pass

