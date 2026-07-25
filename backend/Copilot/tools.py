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
    update_project_requirement,
    append_project_requirements,
)
from rag_service import rag_engine

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
    """Semantic search over project requirements in Qdrant."""
    try:
        kwargs = {"search_text": query, "collection_name": "project_requirements", "top_k": 5}
        if project_id:
            kwargs["filter_dict"] = {"project_id": project_id}
        results = _call_with_supported_kwargs(rag_engine.search, **kwargs)
        if not results:
            return _no_data(f"No matching requirements found for query '{query}'.")

        formatted = []
        for r in results:
            payload = r.get("payload", {})
            meta = payload.get("metadata", {})
            formatted.append(
                f"ID: {meta.get('req_id', 'UNKNOWN')} | Type: {meta.get('req_type', 'UNKNOWN')} "
                f"| Score: {r.get('score', 0):.2f}\nText: {payload.get('text', '')}"
            )
        return "\n\n".join(formatted)
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
    try:
        results = _call_with_supported_kwargs(
            rag_engine.search, search_text=query, collection_name="airam_guidelines", top_k=3
        )
        if not results:
            return _no_data(f"No relevant guidelines found for query '{query}'.")

        formatted = []
        for r in results:
            payload = r.get("payload", {})
            formatted.append(
                f"Source: {payload.get('source')} | Score: {r.get('score', 0):.2f}\n{payload.get('text', '')}"
            )
        return "\n\n".join(formatted)
    except Exception as e:
        return _no_data(f"Error searching guidelines: {e}")


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
    "list_projects": list_projects,
    "get_project_summary": get_project_summary,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_requirements",
            "description": "Semantic search over project requirements (SWE.1/SWE.2) to find requirements mentioning specific concepts.",
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
