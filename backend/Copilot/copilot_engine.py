"""
AIRAM Copilot Orchestration Engine
----------------------------------
Routes user questions through a tool-calling loop against AIRAM's existing
requirements / quality / traceability / RAG data, then synthesizes a final
answer.

CHANGES FROM THE ORIGINAL VERSION (see inline comments marked FIX:):
  1. Import paths made consistent with the rest of the backend (no `backend.`
     prefix), matching how Model/Analysis/RagEngine are imported elsewhere.
  2. Local fallback implementations of get_execution_results /
     get_previous_executions, since these weren't in the documented
     database.py accessor list — prevents an ImportError from killing the
     entire module at startup.
  3. Assistant tool-call messages are serialized to plain dicts before being
     re-sent to the API (raw SDK message objects can trip strict schema
     validation on OpenAI-compatible endpoints).
  4. Nemotron reasoning traces (<think>...</think>) are stripped from the
     final answer before it reaches the user — nvidia/llama-3.3-nemotron
     defaults to "reasoning ON" and wraps chain-of-thought in these tags.
  5. Empty-result detection replaced with an explicit marker instead of
     fragile substring matching (the original check for "coverage: 0%"
     could never match the actual "0.0%" format string it produced).
  6. dispatch_tool now uses signature introspection instead of a
     TypeError-and-retry hack, so it works for any tool signature, not just
     ones that take an optional project_id.
  7. Traceability direction labels (upstream/downstream) and orphan-field
     extraction corrected to match the documented schema. NOTE: verify
     these against your actual analyzer_service.py INSERT statements — the
     docs describe the schema but not the exact row-population logic, so
     this is a best-effort correction, not a verified one.
  8. Hitting the tool-hop limit now forces one final non-tool synthesis
     call instead of returning a bare error.
  9. Defensive `(x or "")` guards before `.lower()` calls, since SQLite NULL
     values surface as None even when the key is present.
 10. A small retry/backoff wrapper around the raw client call, mirroring
     the resilience pattern already used elsewhere in AIRAM for the NVIDIA
     NIM free tier's rate limits.
"""

import inspect
import json
import random
import re
import sqlite3
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# FIX #1: import paths consistent with the rest of the backend. If your
# process is launched with `cd backend && python main.py`, then top-level
# sibling modules (database.py, rag_service.py) are imported bare, the same
# way Model.llm is — not via a `backend.` package prefix.
# ---------------------------------------------------------------------------
from Model.llm import LLMManager
from database import (
    get_all_projects,
    get_project_by_id,
    get_project_requirements_from_db,
    update_project_requirement,
    append_project_requirements,
)
from rag_service import rag_engine

llm = LLMManager()

COPILOT_SYSTEM_PROMPT = """You are the AIRAM Copilot. You have tools to search, retrieve, and modify:
- Requirements (SWE.1/SWE.2) by ID or semantic search, and edit or add requirements
- Quality analysis results and failed rules
- Traceability links, coverage %, and orphaned requirements
- Guideline documents (INCOSE/EARS/custom rules)
- Execution run history and past results

Only call tools if the user's question requires data stored inside AIRAM.

Do NOT call tools for:
- greetings
- introductions
- general conversation
- programming questions
- software engineering concepts
- explanations
- small talk

Examples:

User: Hi
Assistant: Hello! How can I help you today?

User: What is FastAPI?
Assistant: <answer directly>

User: Explain INCOSE.
Assistant: <answer directly>

User: Show requirement REQ-12.
Assistant: call get_requirement_by_id

User: Find requirements mentioning braking.
Assistant: call search_requirements

Always call a tool to fetch real data before answering factual questions about
requirements, traceability, or analysis results. Never invent requirement IDs,
statuses, or rule names — only report what tools return. If a question needs
multiple lookups (e.g. "orphans and their risk"), call tools in sequence.
If no tool result answers the question, say so plainly."""

MAX_TOOL_HOPS = 4
MAX_HISTORY_MESSAGES = 12  # bound context growth across a long chat session

SMALL_TOOL_MODEL = "meta/llama-3.1-8b-instruct"
LARGE_SYNTHESIS_MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1.5"

NO_DATA_MARKER = "[NO_DATA]"
THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


# ---------------------------------------------------------------------------
# FIX #2: local fallback DB accessors.
# database.py's documented accessor list doesn't include get_execution_results
# or get_previous_executions. We try to import the "real" ones first (in case
# they do exist and you've just not documented them); if not, we fall back to
# a self-contained sqlite implementation using the documented schema, so the
# module doesn't hard-crash at import time.
# ---------------------------------------------------------------------------
try:
    from database import get_execution_results as _get_execution_results  # type: ignore
    from database import get_previous_executions as _get_previous_executions  # type: ignore
except ImportError:
    # Match the DB path/mode documented for AIRAM: backend/airam.db, WAL mode.
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
    """Mark a tool response as 'nothing found' with an unambiguous prefix,
    instead of relying on fragile substring sniffing later (FIX #5)."""
    return f"{NO_DATA_MARKER} {msg}"


def is_empty_result(result_text: str) -> bool:
    return (result_text or "").strip().startswith(NO_DATA_MARKER)


def _clean_for_llm(tool_text: str) -> str:
    """Strip the internal no-data marker before the text is sent back to the
    model as a tool result — the model doesn't need to see our bookkeeping."""
    return (tool_text or "").replace(NO_DATA_MARKER, "").strip()


def _strip_reasoning(text: str) -> str:
    """FIX #4: remove <think>...</think> chain-of-thought blocks that
    Nemotron reasoning models emit by default. Safe no-op if the API already
    separates reasoning from content."""
    if not text:
        return text
    return THINK_BLOCK_RE.sub("", text).strip()


def _call_with_supported_kwargs(func, **kwargs):
    """Call `func` with only the keyword args its signature actually accepts.
    Protects against TypeErrors when an assumed helper signature (e.g.
    RAGEngine.search using `limit` instead of `top_k`) doesn't match what
    this module guesses."""
    sig = inspect.signature(func)
    params = sig.parameters
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
        return func(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in params}
    return func(**filtered)


def _retry_call(create_fn, *, max_retries=3, base_delay=1.0, **kwargs):
    """Local exponential-backoff wrapper, mirroring the resilience pattern
    used elsewhere in AIRAM for the NVIDIA NIM free tier's rate limits. We
    can't safely reuse LLMManager._retry_api_call here since this module
    needs raw client access for `tools=`/`tool_choice=`, which
    LLMManager.get_response() doesn't expose."""
    last_err = None
    for attempt in range(max_retries):
        try:
            return create_fn(**kwargs)
        except Exception as e:  # noqa: BLE001 - intentionally broad, re-raised below
            last_err = e
            msg = str(e).lower()
            transient = "429" in msg or "rate" in msg or "timeout" in msg or "503" in msg
            if attempt < max_retries - 1 and transient:
                time.sleep(base_delay * (2 ** attempt) + random.uniform(0, 0.5))
                continue
            raise
    if last_err is not None:
        raise last_err
    raise ValueError("max_retries must be > 0")


# ---------------------------------------------------------------------------
# Project identifier / run lookup helpers
# ---------------------------------------------------------------------------

def get_project_identifiers(project_id: str) -> set:
    """Collect project ID, project name, and lowercase variants for robust
    matching against execution_runs.project_name (which stores a name, not
    an ID)."""
    if not project_id:
        return set()
    identifiers = {project_id, project_id.lower()}

    proj = get_project_by_id(project_id)
    if proj:
        identifiers.add(proj.get("id") or "")
        name = proj.get("name") or ""  # FIX #9: guard against NULL name
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
    for a project. FIX: 'combined' runs contain both quality and traceability
    results but the string 'combined' doesn't contain either keyword as a
    substring, so the original check silently excluded them."""
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
# Tool wrapper functions
# ---------------------------------------------------------------------------

def search_requirements(query: str, project_id: str = None) -> str:
    """Semantic search over project requirements in Qdrant.

    NOTE: this assumes a `project_requirements` collection already contains
    embedded SWE.1/SWE.2 text tagged with project_id in its payload metadata.
    If your RAG ingestion pipeline only embeds guideline documents (not
    requirements themselves) today, this tool will always return no results
    until that ingestion step is built — that's a data gap, not a bug in
    this function.
    """
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
    """Get upstream/downstream traceability links for a requirement.

    FIX #7: per the documented schema, swe1_id/swe1_text hold the *parent*
    SWE.1 for a row whose own req_id is a SWE.2. That means:
      - if `req_id` matches a row's swe1_id -> req_id is the SWE.1 parent,
        and that row's own req_id/input_req is a DOWNSTREAM child.
      - if `req_id` matches a row's own req_id -> req_id is a SWE.2 child,
        and that row's swe1_id/swe1_text is its UPSTREAM parent.
    The original code had these two cases swapped. Verify against your
    analyzer_service.py insert logic if results look off.
    """
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
    """Find orphaned SWE.2 requirements (no SWE.1 parent coverage).

    FIX #7: orphan rows have no parent match, so swe1_id/swe1_text are
    typically empty for them — the orphan's own identity lives in
    req_id/input_req, not swe1_id/swe1_text. The original code printed the
    (empty) parent fields instead of the orphan's own fields.
    """
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
    """FIX #6: use signature introspection instead of a TypeError-and-retry
    hack. This handles any tool signature correctly, filters out params the
    LLM might hallucinate, and injects project_id only where accepted."""
    print(f"  [Tool Execution Start] Tool: '{name}' | Params: {args} | Project Context: '{project_id}'", flush=True)
    if name not in TOOL_REGISTRY:
        print(f"  [Tool Execution Error] Tool '{name}' not found in registry!", flush=True)
        return _no_data(f"Tool '{name}' not found.")

    func = TOOL_REGISTRY[name]
    accepted = set(inspect.signature(func).parameters.keys())

    call_args = dict(args or {})
    if "project_id" in accepted:
        current_pid = str(call_args.get("project_id", "")).strip().lower()
        # If project_id parameter is missing or is a generic LLM placeholder (e.g., 'my_project', 'project_id', 'unknown')
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


# ---------------------------------------------------------------------------
# Message construction & model orchestration
# ---------------------------------------------------------------------------

def needs_tools(message: str) -> bool:
    system = """You are a routing assistant. Return ONLY one word:
TOOL
or
CHAT

Classify if the user's message needs to fetch internal AIRAM project data (requirements, quality rules, orphans, runs) -> TOOL
If it's a greeting, general conversation, or a general programming/engineering question -> CHAT

Examples:
Hi -> CHAT
How are you? -> CHAT
Explain FastAPI -> CHAT
What is requirement REQ-10? -> TOOL
Show failed rules -> TOOL
Search for braking requirements -> TOOL"""
    try:
        res = _retry_call(
            llm.client.chat.completions.create,
            model=SMALL_TOOL_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": message}],
            temperature=0.0,
            max_tokens=10
        )
        ans = (res.choices[0].message.content or "").strip().upper()
        return "CHAT" not in ans
    except Exception as e:
        print(f"[Copilot Router Exception] {e}", flush=True)
        return True


def build_messages(history: list, user_message: str, system_prompt: str) -> list:
    msgs = [{"role": "system", "content": system_prompt}]
    for h in (history or [])[-MAX_HISTORY_MESSAGES:]:
        role, content = h.get("role"), h.get("content")
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": user_message})
    return msgs


def _serialize_assistant_message(message) -> dict:
    """FIX #3: convert the SDK Message object into a plain dict before it's
    re-sent as conversation history. Passing the raw pydantic object back
    into the next create() call is a common source of 400s on strict
    OpenAI-compatible endpoints."""
    out = {"role": "assistant", "content": message.content or ""}
    if getattr(message, "tool_calls", None):
        out["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
            }
            for tc in message.tool_calls
        ]
    return out


def run_copilot_turn_stream(project_id: str, user_message: str, history: list):
    """Main orchestration loop, streaming 'thinking' events as tools fire and
    a final 'final' event with the synthesized answer (or 'error')."""
    print(f"\n==================== [COPILOT TURN START] ====================", flush=True)
    print(f"[Copilot Input] Message: '{user_message}'", flush=True)
    print(f"[Copilot Context] Project ID: '{project_id}' | History Count: {len(history or [])}", flush=True)

    use_tools = needs_tools(user_message)
    print(f"[Copilot Router] Needs tools: {use_tools}", flush=True)

    active_prompt = COPILOT_SYSTEM_PROMPT
    if project_id:
        active_prompt += f"\n\nCRITICAL CONTEXT:\nThe user is currently viewing project ID: '{project_id}'. Unless they explicitly specify a different project, assume all their questions and tool calls refer to this project. Do NOT ask them for a project ID, use '{project_id}' automatically."

    messages = build_messages(history, user_message, system_prompt=active_prompt)

    had_tool_calls = False
    last_tool_results: list = []

    for step in range(MAX_TOOL_HOPS):
        force_final = (step == MAX_TOOL_HOPS - 1) or not use_tools
        print(f"\n--- [Copilot Hop {step + 1}/{MAX_TOOL_HOPS}] ---", flush=True)

        try:
            all_results_empty = bool(last_tool_results) and all(
                is_empty_result(r) for r in last_tool_results
            )
            
            if had_tool_calls and all_results_empty:
                force_final = True
                
            target_model = (
                SMALL_TOOL_MODEL if (not had_tool_calls and not force_final) else LARGE_SYNTHESIS_MODEL
            )
            print(f"[Copilot API Request] Target Model: '{target_model}' | Had Tool Calls: {had_tool_calls} | All Previous Results Empty: {all_results_empty}", flush=True)

            create_kwargs = dict(
                model=target_model,
                messages=messages,
                temperature=1.0 if target_model == "google/gemma-4-31b-it" else 0.0,
            )
            if target_model == "google/gemma-4-31b-it":
                create_kwargs["top_p"] = 0.95
                create_kwargs["max_tokens"] = 16384
                create_kwargs["extra_body"] = {
                    "chat_template_kwargs": {
                        "enable_thinking": True
                    }
                }

            if not force_final:
                create_kwargs["tools"] = TOOL_SCHEMAS
                create_kwargs["tool_choice"] = "auto"

            response = _retry_call(llm.client.chat.completions.create, **create_kwargs)

            if not response.choices:
                print(f"[Copilot Error] Empty response returned by model {target_model}", flush=True)
                yield {"type": "error", "text": "The model returned an empty response."}
                return

            message = response.choices[0].message

            if message.tool_calls and not force_final:
                had_tool_calls = True
                last_tool_results = []
                messages.append(_serialize_assistant_message(message))

                print(f"[Copilot Model Decision] Model decided to execute {len(message.tool_calls)} tool call(s).", flush=True)

                for call in message.tool_calls:
                    func_name = call.function.name
                    try:
                        func_args = json.loads(call.function.arguments or "{}")
                    except json.JSONDecodeError:
                        func_args = {}

                    print(f"  -> Selected Tool: '{func_name}' | Args: {func_args}", flush=True)
                    yield {"type": "thinking", "message": f"Using {func_name}...", "args": func_args}

                    result = dispatch_tool(func_name, func_args, project_id)
                    last_tool_results.append(str(result))

                    messages.append({
                        "role": "tool",
                        "tool_call_id": call.id,
                        "name": func_name,
                        "content": _clean_for_llm(str(result)),
                    })
                continue

            final_text = _strip_reasoning(message.content or "")
            if not final_text:
                final_text = "I wasn't able to generate a response — please try rephrasing your question."
            print(f"[Copilot Final Answer] Model: '{target_model}' | Output Length: {len(final_text)} chars", flush=True)
            print(f"==================== [COPILOT TURN END] ====================\n", flush=True)
            yield {"type": "final", "text": final_text}
            return

        except Exception as e:
            print(f"[Copilot Engine Exception] {e}", flush=True)
            print(f"==================== [COPILOT TURN END (ERROR)] ====================\n", flush=True)
            yield {"type": "error", "text": f"An error occurred while generating a response: {e}"}
            return

    print(f"[Copilot Max Hops Reached] Hit limit of {MAX_TOOL_HOPS} hops.", flush=True)
    print(f"==================== [COPILOT TURN END (LIMIT)] ====================\n", flush=True)
    yield {"type": "error", "text": "Copilot hit the maximum number of tool hops without reaching a conclusion."}
