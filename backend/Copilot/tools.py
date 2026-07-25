"""
AIRAM Copilot Tools Module
--------------------------
Contains all tool implementations, schemas, registries, and DB lookup helpers
used by the AIRAM Copilot Orchestration Engine.
"""

import inspect
import json
import sqlite3
from pathlib import Path

from database import (
    get_all_projects,
    get_project_by_id,
    get_project_requirements_from_db,
    append_project_requirements,
)

NO_DATA_MARKER = "[NO_DATA]"

# ---------------------------------------------------------------------------
# Fallback DB accessors
# ---------------------------------------------------------------------------
try:
    from database import get_execution_results as _get_execution_results  # type: ignore
    from database import get_previous_executions as _get_previous_executions  # type: ignore
except ImportError:
    _DB_PATH = Path(__file__).resolve().parent.parent / "airam.db"

    def _connect():
        conn = sqlite3.connect(str(_DB_PATH), timeout=20)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        return conn

    def _get_execution_results(run_id: str) -> list:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT * FROM execution_results WHERE run_id = ?", (run_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def _get_previous_executions(limit: int = 30) -> list:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT * FROM execution_runs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

def _no_data(msg: str) -> str:
    """Mark a tool response as 'nothing found' with an unambiguous prefix."""
    return f"{NO_DATA_MARKER} {msg}"


def is_empty_result(result_text: str) -> bool:
    return (result_text or "").strip().startswith(NO_DATA_MARKER)


def _clean_for_llm(tool_text: str) -> str:
    """Strip internal no-data marker before sending text back to the LLM."""
    return (tool_text or "").replace(NO_DATA_MARKER, "").strip()


def _call_with_supported_kwargs(func, **kwargs):
    """Call `func` with only keyword arguments accepted by its signature."""
    sig = inspect.signature(func)
    params = sig.parameters
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
        return func(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in params}
    return func(**filtered)


# ---------------------------------------------------------------------------
# Project identifier / run lookup helpers
# ---------------------------------------------------------------------------

def get_project_identifiers(project_id: str) -> set:
    """Collect project ID, name, and lowercase variants for robust matching."""
    if not project_id:
        return set()
    identifiers = {project_id, project_id.lower()}

    proj = get_project_by_id(project_id)
    if proj:
        identifiers.add(proj.get("id") or "")
        name = proj.get("name") or ""
        identifiers.add(name)
        identifiers.add(name.lower())

    for p in get_all_projects():
        name = p.get("name") or ""
        if name.lower() == project_id.lower() or p.get("id") == project_id:
            identifiers.add(p.get("id") or "")
            identifiers.add(name)
            identifiers.add(name.lower())

    identifiers.discard("")
    return identifiers


def find_target_run(project_id: str, run_type_keyword: str):
    """Find the most recent run of a given type ('quality' / 'traceability')
    for a project."""
    runs = _get_previous_executions(limit=30)
    identifiers = get_project_identifiers(project_id)

    for r in runs:
        r_pname = r.get("project_name") or ""
        r_pid = r.get("project_id") or ""
        r_type = (r.get("type") or "").lower()

        matches_proj = (
            not identifiers
            or r_pname in identifiers
            or r_pname.lower() in identifiers
            or r_pid in identifiers
        )
        matches_type = (run_type_keyword in r_type) or (r_type == "combined")
        if matches_proj and matches_type:
            return r
    return None


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def search_requirements(query: str, project_id: str = None) -> str:
    """Keyword search over project requirements."""
    try:
        if not project_id:
            return _no_data("project_id is required to search requirements.")
        
        matches = []
        query_lower = query.lower()
        
        for req_type in ["sys1", "sys2", "sys3", "swe1", "swe2"]:
            reqs = get_project_requirements_from_db(project_id, req_type)
            for req in reqs:
                req_text = (req.get("text") or "").lower()
                req_id = (req.get("id") or req.get("req_id") or "").lower()
                
                if query_lower in req_text or query_lower in req_id:
                    matches.append(
                        f"ID: {req.get('id') or req.get('req_id')} | Type: {req_type.upper()} "
                        f"\nText: {req.get('text', '')}"
                    )
                    
        if not matches:
            return _no_data(f"No matching requirements found for query '{query}'.")
            
        return "\n\n".join(matches[:10])  # return top 10 matches to avoid context bloat
    except Exception as e:
        return _no_data(f"Error searching requirements: {e}")

def get_all_requirements_by_type(req_type: str, project_id: str = None) -> str:
    """Fetch all requirements of a specific type for a project."""
    if not project_id:
        return _no_data("project_id is required to fetch requirements by type.")
    
    valid_types = ["sys1", "sys2", "sys3", "swe1", "swe2"]
    clean_type = (req_type or "").lower().replace(".", "")
    if clean_type not in valid_types:
        return _no_data(f"Invalid requirement type '{req_type}'. Must be one of: {', '.join(valid_types)}")
        
    reqs = get_project_requirements_from_db(project_id, clean_type)
    if not reqs:
        return _no_data(f"No {clean_type.upper()} requirements found in project {project_id}.")
        
    formatted = []
    for r in reqs:
        formatted.append(f"ID: {r.get('id')} | Text: {r.get('text')}")
    
    return "\n".join(formatted)


def get_requirement_by_id(req_id: str, project_id: str = None) -> str:
    if not project_id:
        return _no_data("project_id is required to fetch a requirement by ID.")

    for req_type in ["sys1", "sys2", "sys3", "swe1", "swe2"]:
        reqs = get_project_requirements_from_db(project_id, req_type)
        for req in reqs:
            if req.get("id") == req_id or req.get("req_id") == req_id:
                return json.dumps(req, indent=2)
    return _no_data(f"Requirement {req_id} not found in project {project_id}.")


def edit_requirement(req_id: str, new_text: str, req_type: str, project_id: str = None) -> str:
    if not project_id:
        return _no_data("project_id is required to edit a requirement.")
    success = update_project_requirement(project_id, req_type, req_id, new_text)
    if success is False:
        return _no_data(f"Failed to update requirement {req_id}. It may not exist in project {project_id} under type {req_type}.")
    return f"Successfully updated requirement {req_id}."


def add_requirement(req_id: str, text: str, req_type: str, project_id: str = None) -> str:
    if not project_id:
        return _no_data("project_id is required to add a requirement.")
    req_obj = {"id": req_id, "text": text}
    try:
        append_project_requirements(project_id, [req_obj], req_type)
        return f"Successfully added requirement {req_id}."
    except Exception as e:
        return _no_data(f"Failed to add requirement: {e}")


def get_traceability_for_req(req_id: str, project_id: str = None) -> str:
    r = find_target_run(project_id, "traceability")
    if not r:
        return _no_data(
            f"No recent traceability analysis run found for project '{project_id}'. "
            "Please run a Traceability analysis first."
        )

    results = _get_execution_results(r["run_id"])
    traces = []
    for row in results:
        if row.get("swe1_id") == req_id:
            traces.append(f"Downstream link: {row.get('req_id')} - {row.get('input_req')}")
        elif row.get("req_id") == req_id:
            traces.append(f"Upstream link: {row.get('swe1_id')} - {row.get('swe1_text')}")

    if not traces:
        return _no_data(f"No traceability links found for requirement {req_id}.")
    return "\n".join(traces)


def find_orphans(project_id: str) -> str:
    r = find_target_run(project_id, "traceability")
    if not r:
        return _no_data(
            f"No recent traceability analysis run found for project '{project_id}'. "
            "Please run a Traceability analysis first."
        )

    results = _get_execution_results(r["run_id"])
    orphans = []
    for row in results:
        rationale = (row.get("rationale") or "").lower()
        if row.get("status") == "FAIL" and "orphan" in rationale:
            orphan_id = row.get("req_id") or row.get("swe1_id") or "UNKNOWN"
            orphan_text = row.get("input_req") or row.get("swe1_text") or ""
            orphans.append(f"Orphaned: {orphan_id} - {orphan_text}")

    if not orphans:
        return _no_data(f"No orphaned requirements found for project '{project_id}'.")
    return "\n".join(orphans)


def get_traceability_coverage(project_id: str) -> str:
    r = find_target_run(project_id, "traceability")
    if not r:
        return _no_data(f"No recent traceability analysis run found for project '{project_id}'.")

    results = _get_execution_results(r["run_id"])
    total_swe1 = len({row.get("swe1_id") for row in results if row.get("swe1_id")})
    covered = len({
        row.get("swe1_id") for row in results
        if row.get("swe1_id") and row.get("status") == "PASS"
    })

    if total_swe1 == 0:
        return _no_data("Coverage unavailable: 0 SWE.1 requirements found in the latest run.")
    pct = (covered / total_swe1) * 100
    return f"Coverage for project '{project_id}': {pct:.1f}% ({covered}/{total_swe1} SWE.1 requirements covered)"


def get_quality_results(project_id: str, status_filter: str = "FAIL") -> str:
    r = find_target_run(project_id, "quality")
    if not r:
        return _no_data(f"No recent quality analysis run found for project '{project_id}'.")

    results = _get_execution_results(r["run_id"])
    filtered = [row for row in results if row.get("status") == status_filter]

    if not filtered:
        return _no_data(f"No requirements found with status {status_filter}.")

    out = [
        f"REQ: {row.get('req_id')} | Status: {row.get('status')} | "
        f"Rule: {row.get('failed_rule')} | Rationale: {row.get('rationale')}"
        for row in filtered
    ]
    if len(out) > 10:
        return "\n".join(out[:10]) + f"\n...and {len(out) - 10} more."
    return "\n".join(out)


def get_failed_rules_summary(project_id: str) -> str:
    r = find_target_run(project_id, "quality")
    if not r:
        return _no_data(f"No recent quality analysis run found for project '{project_id}'.")

    results = _get_execution_results(r["run_id"])
    rules = {}
    for row in results:
        if row.get("status") == "FAIL":
            rule = row.get("failed_rule") or "Unknown Rule"
            rules[rule] = rules.get(rule, 0) + 1

    if not rules:
        return _no_data(f"No failed rules found for project '{project_id}'.")
    return json.dumps(rules, indent=2)


def search_guidelines(query: str) -> str:
    """Keyword search over guideline rules in database."""
    try:
        from database import get_all_guidelines, get_guideline_content
        import json
        
        guidelines = get_all_guidelines()
        if not guidelines:
            return _no_data("No guidelines available to search.")
            
        query_lower = query.lower()
        matches = []
        
        for g in guidelines:
            g_id = g.get("id")
            g_name = g.get("name") or "Unnamed Guideline"
            content = get_guideline_content(g_id)
            if not content:
                continue
                
            content_str = json.dumps(content)
            if query_lower in content_str.lower():
                matches.append(
                    f"Source Document: {g_name} (ID: {g_id})\nMatching Content Snippet:\n{content_str[:1500]}..."
                )
                
        if not matches:
            return _no_data(f"No relevant guidelines found for query '{query}'.")
            
        return "\n\n".join(matches[:5])
    except Exception as e:
        return _no_data(f"Error searching guidelines: {e}")


def list_guideline_files() -> str:
    """Get a list of all available guideline files."""
    try:
        from database import get_all_guidelines
        guidelines = get_all_guidelines()
        
        if not guidelines:
            return _no_data("No guidelines have been uploaded yet.")
            
        docs = [f"{g.get('name')} (ID: {g.get('id')})" for g in guidelines if g.get('name')]
        return "Available guideline documents:\n- " + "\n- ".join(docs)
    except Exception as e:
        return _no_data(f"Error listing guidelines: {e}")


def fetch_guideline_content(doc_name: str) -> str:
    """Fetch the full structured content of a specific guideline document by name or ID."""
    try:
        from database import get_all_guidelines, get_guideline_content
        import json
        
        guidelines = get_all_guidelines()
        target_id = None
        for g in guidelines:
            if g.get('id') == doc_name or g.get('name') == doc_name:
                target_id = g.get('id')
                break
                
        if not target_id:
            return _no_data(f"No content found for guideline '{doc_name}'.")
            
        content = get_guideline_content(target_id)
        if not content:
             return _no_data(f"Guideline '{doc_name}' is empty.")
             
        full_text = json.dumps(content, indent=2)
        
        if len(full_text) > 40000:
            full_text = full_text[:40000] + "\n\n...[CONTENT TRUNCATED FOR LENGTH]..."
            
        return f"--- Content of {doc_name} ---\n\n{full_text}"
    except Exception as e:
        return _no_data(f"Error fetching guideline '{doc_name}': {e}")


def get_previous_runs_info(project_id: str, run_type: str = None) -> str:
    """Get information about previous execution runs for a project, including which guideline document was used."""
    if not project_id:
        return _no_data("project_id is required to fetch previous execution runs.")
        
    runs = _get_previous_executions(limit=20)
    identifiers = get_project_identifiers(project_id)
    
    matching_runs = []
    for r in runs:
        r_pname = r.get("project_name") or ""
        r_pid = r.get("project_id") or ""
        r_type = (r.get("type") or "").lower()
        
        matches_proj = (
            not identifiers
            or r_pname in identifiers
            or r_pname.lower() in identifiers
            or r_pid in identifiers
        )
        if not matches_proj:
            continue
            
        if run_type and run_type.lower() not in r_type:
            continue
            
        matching_runs.append(
            f"Run ID: {r.get('run_id')} | Type: {r.get('type')} | Status: {r.get('status')} | Guideline Used: {r.get('guideline_name') or 'Default/None'} | Date: {r.get('timestamp', '')}"
        )
        
    if not matching_runs:
        return _no_data(f"No previous execution runs found for project '{project_id}'.")
        
    return "Previous execution runs for this project:\n" + "\n".join(matching_runs[:10])


def list_projects() -> str:
    projs = get_all_projects()
    if not projs:
        return _no_data("No projects currently found in the system.")
    return "\n".join(
        f"ID: {p.get('id')} | Name: {p.get('name')} | Description: {p.get('description') or ''}"
        for p in projs
    )


def get_project_summary(project_id: str) -> str:
    identifiers = get_project_identifiers(project_id)
    proj = next(
        (p for p in get_all_projects() if p.get("id") in identifiers or p.get("name") in identifiers),
        None,
    )
    if not proj:
        return _no_data(f"Project '{project_id}' not found.")

    counts = {
        rt: len(get_project_requirements_from_db(proj["id"], rt))
        for rt in ("sys1", "sys2", "sys3", "swe1", "swe2")
    }
    return (
        f"Project: {proj['name']} ({proj['id']})\n"
        f"Description: {proj.get('description') or ''}\n"
        f"SYS.1: {counts['sys1']} | SYS.2: {counts['sys2']} | SYS.3: {counts['sys3']} | "
        f"SWE.1: {counts['swe1']} | SWE.2: {counts['swe2']}"
    )


# ---------------------------------------------------------------------------
# UML Diagram Generation
# ---------------------------------------------------------------------------

DIAGRAM_TYPES = {
    "usecase": {
        "label": "Use Case Diagram",
        "hint": (
            "Model actors and use cases. Use `actor` for external users/systems, "
            "ellipses (use case names) for system behaviors, and connect them with "
            "association lines. Use <<include>> / <<extend>> where relevant."
        ),
    },
    "class": {
        "label": "Class Diagram",
        "hint": (
            "Model classes with their key attributes and methods, and show "
            "relationships (association, aggregation, composition, inheritance) "
            "with correct PlantUML arrow notation (e.g. --|>, *--, o--, --> )."
        ),
    },
    "sequence": {
        "label": "Sequence Diagram",
        "hint": (
            "Model the participants (actors/objects) and the ordered messages "
            "exchanged between them. For conditional branches, use PlantUML syntax:\n"
            "- `alt [condition] ... else [condition] ... end` (CRITICAL: NEVER use `else if`, `endif`, `endopt`, or `endalt`; conditional blocks MUST terminate with `end`)\n"
            "- `opt [condition] ... end`\n"
            "- `loop [condition] ... end`"
        ),
    },
    "activity": {
        "label": "Activity Diagram",
        "hint": (
            "Model the workflow as an activity diagram using PlantUML's "
            "`start`, `stop`, `if (condition) then (yes) ... else (no) ... endif`, and `:action;` syntax to capture "
            "the process steps and decision points in the requirements."
        ),
    },
}

PLANTUML_SERVER = "http://www.plantuml.com/plantuml/img/"


def _build_uml_prompt(requirements_text: str, diagram_type: str) -> list:
    """Builds the chat messages sent to the LLM for UML generation."""
    diagram_info = DIAGRAM_TYPES[diagram_type]

    system_prompt = (
        "/no_think\n"
        "You are a senior software architect who translates software "
        "engineering requirements into precise UML diagrams. "
        "You respond with VALID PlantUML markup ONLY - no explanations, "
        "no markdown code fences, no commentary before or after. "
        "Your entire response must start with '@startuml' and end with "
        "'@enduml'. Keep names concise, derive them directly from the "
        "requirements, and make sure the PlantUML syntax is syntactically "
        "correct so it renders without errors."
    )

    user_prompt = (
        f"Diagram type: {diagram_info['label']}\n"
        f"Modeling guidance: {diagram_info['hint']}\n\n"
        f"Software requirements:\n\"\"\"\n{requirements_text}\n\"\"\"\n\n"
        "Generate the PlantUML source for this diagram now."
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _sanitize_plantuml(puml: str, diagram_type: str) -> str:
    """Fix common PlantUML syntax mistakes made by LLMs."""
    import re as _re
    if not puml:
        return ""

    if diagram_type == "sequence":
        # Replace invalid `else if ...` with `else ...`
        puml = _re.sub(r'^\s*else\s+if\b', 'else', puml, flags=_re.MULTILINE | _re.IGNORECASE)
        # Replace invalid block terminators `endif`, `endopt`, `endalt`, `endloop` with `end`
        puml = _re.sub(r'^\s*(?:endif|endopt|endalt|endloop)\b', 'end', puml, flags=_re.MULTILINE | _re.IGNORECASE)

    return puml


def _extract_plantuml(raw_text: str, diagram_type: str = "") -> str:
    """Pulls the @startuml ... @enduml block out of an LLM response and sanitizes syntax."""
    import re as _re
    if not raw_text:
        return ""

    cleaned = _re.sub(r"<think>.*?</think>", "", raw_text, flags=_re.DOTALL | _re.IGNORECASE)
    fenced = _re.search(r"```(?:plantuml|puml)?\s*(.*?)```", cleaned, _re.DOTALL | _re.IGNORECASE)
    candidate = fenced.group(1) if fenced else cleaned
    match = _re.search(r"(@startuml.*?@enduml)", candidate, _re.DOTALL | _re.IGNORECASE)
    
    if match:
        puml = match.group(1).strip()
    else:
        stripped = candidate.strip()
        puml = f"@startuml\n{stripped}\n@enduml" if stripped else ""

    return _sanitize_plantuml(puml, diagram_type)


def _render_plantuml_png(plantuml_source: str) -> bytes:
    """Render PlantUML source to PNG via public PlantUML server using standard library only."""
    import urllib.request
    import zlib

    def _encode_6bit(b):
        if b < 10:
            return chr(48 + b)
        b -= 10
        if b < 26:
            return chr(65 + b)
        b -= 26
        if b < 26:
            return chr(97 + b)
        b -= 26
        if b == 0:
            return '-'
        if b == 1:
            return '_'
        return '?'

    compressor = zlib.compressobj(9, zlib.DEFLATED, -15)
    compressed = compressor.compress(plantuml_source.encode('utf-8')) + compressor.flush()

    res = []
    i = 0
    length = len(compressed)
    while i < length:
        b1 = compressed[i]
        b2 = compressed[i + 1] if i + 1 < length else 0
        b3 = compressed[i + 2] if i + 2 < length else 0
        
        c1 = b1 >> 2
        c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
        c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
        c4 = b3 & 0x3F
        
        res.append(_encode_6bit(c1 & 0x3F))
        res.append(_encode_6bit(c2 & 0x3F))
        if i + 1 < length:
            res.append(_encode_6bit(c3 & 0x3F))
        if i + 2 < length:
            res.append(_encode_6bit(c4 & 0x3F))
            
        i += 3
        
    encoded = "".join(res)
    url = PLANTUML_SERVER.rstrip("/") + "/" + encoded
    
    req = urllib.request.Request(url, headers={"User-Agent": "AIRAM-UML/1.0"})
    with urllib.request.urlopen(req, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"PlantUML server returned HTTP {response.status}")
        return response.read()


def generate_uml_diagram(diagram_type: str, project_id: str = None, req_types: str = None) -> str:
    """Generate a UML diagram from project requirements.
    
    Args:
        diagram_type: One of 'usecase', 'class', 'sequence', 'activity'
        project_id: The project to fetch requirements from
        req_types: Comma-separated requirement types to include (e.g. 'sys1,swe1'). 
                   Defaults to all types.
    """
    import base64

    if not project_id:
        return _no_data("project_id is required to generate a UML diagram.")

    dt = diagram_type.lower().strip()
    if dt not in DIAGRAM_TYPES:
        return _no_data(f"Unknown diagram type '{diagram_type}'. Supported: usecase, class, sequence, activity.")

    # Determine which requirement types to fetch
    if req_types:
        types_to_fetch = [t.strip().lower().replace(".", "") for t in req_types.split(",")]
    else:
        types_to_fetch = ["sys1", "sys2", "sys3", "swe1", "swe2"]

    # Gather requirements text
    all_reqs_text = []
    for rt in types_to_fetch:
        reqs = get_project_requirements_from_db(project_id, rt)
        for req in reqs:
            req_id = req.get("id") or req.get("req_id") or "UNKNOWN"
            req_text = req.get("text") or ""
            if req_text:
                all_reqs_text.append(f"{req_id}: {req_text}")

    if not all_reqs_text:
        return _no_data(f"No requirements found for the specified types ({', '.join(types_to_fetch)}) in this project.")

    # Truncate to avoid exceeding context limits
    combined_text = "\n".join(all_reqs_text)
    if len(combined_text) > 6000:
        combined_text = combined_text[:6000] + "\n...[TRUNCATED]..."

    # Call the LLM to generate PlantUML
    raw_response = ""
    try:
        from Model.llm import LLMManager
        llm_mgr = LLMManager()
        messages = _build_uml_prompt(combined_text, dt)
        
        response = llm_mgr.client.chat.completions.create(
            model="nvidia/llama-3.3-nemotron-super-49b-v1.5",
            messages=messages,
            temperature=0.2,
            top_p=0.7,
            max_tokens=2048,
            stream=False,
        )
        raw_response = response.choices[0].message.content or ""
    except Exception as exc:
        # Fallback to pure stdlib urllib HTTP POST if openai module isn't loaded in interpreter
        try:
            import os
            import urllib.request
            api_key = os.getenv("NVIDIA_API_KEY", "")
            if not api_key:
                return _no_data(f"Error calling LLM for UML generation: {exc}")
            
            messages = _build_uml_prompt(combined_text, dt)
            payload_bytes = json.dumps({
                "model": "nvidia/llama-3.3-nemotron-super-49b-v1.5",
                "messages": messages,
                "temperature": 0.2,
                "top_p": 0.7,
                "max_tokens": 2048
            }).encode("utf-8")
            
            req = urllib.request.Request(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                data=payload_bytes,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_response = data["choices"][0]["message"]["content"]
        except Exception as e2:
            return _no_data(f"Error calling LLM for UML generation: {e2}")

    plantuml_code = _extract_plantuml(raw_response, dt)
    if not plantuml_code:
        return _no_data("The model did not return usable PlantUML markup. Try rephrasing or selecting different requirement types.")

    # Render to PNG
    image_base64 = None
    render_error = None
    try:
        png_bytes = _render_plantuml_png(plantuml_code)
        image_base64 = base64.b64encode(png_bytes).decode("ascii")
    except Exception as e:
        render_error = (
            f"Diagram text was generated, but rendering failed: {e}. "
            "You can copy the PlantUML source and paste it at https://www.plantuml.com/plantuml/uml/"
        )

    # Return as a JSON string with structured data
    result = {
        "diagram_type": dt,
        "diagram_label": DIAGRAM_TYPES[dt]["label"],
        "plantuml_code": plantuml_code,
        "image_base64": image_base64,
        "render_error": render_error,
        "requirements_used": len(all_reqs_text),
    }
    return json.dumps(result)


# ---------------------------------------------------------------------------
# Registry + schemas
# ---------------------------------------------------------------------------

TOOL_REGISTRY = {
    "search_requirements": search_requirements,
    "get_requirement_by_id": get_requirement_by_id,
    "get_all_requirements_by_type": get_all_requirements_by_type,
    "edit_requirement": edit_requirement,
    "add_requirement": add_requirement,
    "get_traceability_for_req": get_traceability_for_req,
    "find_orphans": find_orphans,
    "get_traceability_coverage": get_traceability_coverage,
    "get_quality_results": get_quality_results,
    "get_failed_rules_summary": get_failed_rules_summary,
    "search_guidelines": search_guidelines,
    "list_guideline_files": list_guideline_files,
    "fetch_guideline_content": fetch_guideline_content,
    "get_previous_runs_info": get_previous_runs_info,
    "list_projects": list_projects,
    "get_project_summary": get_project_summary,
    "generate_uml_diagram": generate_uml_diagram,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_requirements",
            "description": "Keyword search over project requirements to find requirements mentioning specific concepts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g. 'lateral velocity', 'brake system')"},
                    "project_id": {"type": "string", "description": "The project ID or name to scope the search"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_requirement_by_id",
            "description": "Exact lookup of a requirement by its ID (e.g. REQ-LDW-042).",
            "parameters": {
                "type": "object",
                "properties": {"req_id": {"type": "string"}, "project_id": {"type": "string"}},
                "required": ["req_id", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_all_requirements_by_type",
            "description": "Fetch all requirements of a specific type (e.g., sys1, sys2, sys3, swe1, swe2) for the current project. Use this when the user asks to summarize or list all requirements of a certain level.",
            "parameters": {
                "type": "object",
                "properties": {
                    "req_type": {"type": "string", "description": "The type of requirements to fetch (sys1, sys2, sys3, swe1, swe2)"},
                    "project_id": {"type": "string"}
                },
                "required": ["req_type", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_requirement",
            "description": "Edit the text of an existing requirement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "req_id": {"type": "string", "description": "The requirement ID to edit"},
                    "new_text": {"type": "string", "description": "The new text for the requirement"},
                    "req_type": {"type": "string", "description": "The type of the requirement (e.g. 'swe1', 'swe2')"},
                    "project_id": {"type": "string"}
                },
                "required": ["req_id", "new_text", "req_type", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_requirement",
            "description": "Add a new requirement to the project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "req_id": {"type": "string", "description": "The new requirement ID"},
                    "text": {"type": "string", "description": "The text of the requirement"},
                    "req_type": {"type": "string", "description": "The type of the requirement (e.g. 'swe1', 'swe2')"},
                    "project_id": {"type": "string"}
                },
                "required": ["req_id", "text", "req_type", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_traceability_for_req",
            "description": "Get downstream/upstream traceability links for a specific requirement.",
            "parameters": {
                "type": "object",
                "properties": {"req_id": {"type": "string"}, "project_id": {"type": "string"}},
                "required": ["req_id", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_orphans",
            "description": "Find orphaned SWE.2 requirements (requirements with no upstream SWE.1 coverage).",
            "parameters": {
                "type": "object",
                "properties": {"project_id": {"type": "string"}},
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_traceability_coverage",
            "description": "Get overall traceability coverage percentage for a project.",
            "parameters": {
                "type": "object",
                "properties": {"project_id": {"type": "string"}},
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_quality_results",
            "description": "Get a list of requirements that failed quality checks in the latest run.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "status_filter": {"type": "string", "enum": ["FAIL", "PASS", "REVIEW"], "default": "FAIL"},
                },
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_failed_rules_summary",
            "description": "Get an aggregated count of the most commonly violated quality rules.",
            "parameters": {
                "type": "object",
                "properties": {"project_id": {"type": "string"}},
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_guidelines",
            "description": "Search existing guideline documents (INCOSE, EARS, ISO26262) for rules and best practices.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_guideline_files",
            "description": "Get a list of all available strict guideline documents that have been uploaded.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_guideline_content",
            "description": "Fetch the full text content of a specific guideline document by its filename.",
            "parameters": {
                "type": "object",
                "properties": {"doc_name": {"type": "string", "description": "The exact name of the guideline document"}},
                "required": ["doc_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_previous_runs_info",
            "description": "Check previous execution runs (quality/traceability/correction history) for a project. Returns run history including which guideline document was used.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "run_type": {"type": "string", "description": "Optional filter for run type: 'quality' or 'traceability'"}
                },
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_projects",
            "description": "List all available projects in the system.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_project_summary",
            "description": "Get high-level summary and requirement counts of a specific project.",
            "parameters": {
                "type": "object",
                "properties": {"project_id": {"type": "string"}},
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_uml_diagram",
            "description": "Generate a UML diagram (use case, class, sequence, or activity) from the project's requirements. Returns a rendered PNG image.",
            "parameters": {
                "type": "object",
                "properties": {
                    "diagram_type": {
                        "type": "string",
                        "enum": ["usecase", "class", "sequence", "activity"],
                        "description": "Type of UML diagram to generate"
                    },
                    "project_id": {"type": "string"},
                    "req_types": {
                        "type": "string",
                        "description": "Comma-separated requirement types to use as context (e.g. 'sys1,swe1'). Defaults to all types."
                    }
                },
                "required": ["diagram_type", "project_id"],
            },
        },
    },
]


def dispatch_tool(name: str, args: dict, project_id: str = None) -> str:
    """Introspect signature, inject project_id if accepted, and execute tool."""
    print(f"  [Tool Execution Start] Tool: '{name}' | Params: {args} | Project Context: '{project_id}'", flush=True)
    if name not in TOOL_REGISTRY:
        print(f"  [Tool Execution Error] Tool '{name}' not found in registry!", flush=True)
        return _no_data(f"Tool '{name}' not found.")

    func = TOOL_REGISTRY[name]
    accepted = set(inspect.signature(func).parameters.keys())

    call_args = dict(args or {})
    if "project_id" in accepted:
        current_pid = str(call_args.get("project_id", "")).strip().lower()
        is_placeholder = not current_pid or current_pid in ["my_project", "your_project_id", "project_id", "none", "null", "undefined", "unknown", "<project_id>"]
        if is_placeholder and project_id:
            call_args["project_id"] = project_id

    call_args = {k: v for k, v in call_args.items() if k in accepted}

    try:
        res = func(**call_args)
        res_str = str(res)
        preview = res_str[:120].replace('\n', ' ') + ('...' if len(res_str) > 120 else '')
        print(f"  [Tool Execution Complete] Tool: '{name}' | Output Preview: {preview}", flush=True)
        return res
    except Exception as e:
        print(f"  [Tool Execution Exception] Tool '{name}' failed: {e}", flush=True)
        return _no_data(f"Error executing tool '{name}': {e}")
