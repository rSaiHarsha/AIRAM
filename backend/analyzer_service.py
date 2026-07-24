import os
import sys
import json
import uuid
import time
import asyncio

from Model.llm import LLMManager
from Model.requirement import Requirement
from Analysis.quality_analyser import analyze_single_requirement, correct_single_requirement
import Analysis.quality_analyser as qa_mod
from backend.database import (
    save_execution_run,
    update_execution_status,
    save_execution_result,
    create_placeholder_result,
    update_execution_result_by_id,
    get_guideline_content,
    get_guideline_details,
    update_execution_progress,
    get_execution_run,
    get_execution_status,
)
from backend.rag_service import rag_engine
from backend.file_parser import parse_requirements_file
from Analysis.traceability_analyser import analyze_traceability_generic_with_llm, correct_traceability_requirement, correct_orphaned_swe2

# Active execution state tracker for single process fallback (still kept for backward compatibility, but DB is source of truth)
ACTIVE_JOBS = {}  # run_id -> { "status": "running" | "paused" | "stopped", "current_row": int, "total_rows": int }

def analyze_quality(
    idx: int,
    r: Requirement,
    llm: LLMManager,
    rag,
    rules_context: str,
    is_strict_json: bool,
    correct_quality: bool = False,
    custom_context: str = None,
    custom_context_correction: str = None
) -> dict:
    """Performs compliance check using POC auditor and performs automated rewrite correction if violation found and requested."""
    # 1. Run POC quality auditor
    _, res = analyze_single_requirement(
        index=idx,
        r=r,
        llm=llm,
        rag=rag,
        rag_context=rules_context,
        selected_collections="airam_guidelines",
        is_strict_json=is_strict_json,
        custom_context=custom_context
    )
    
    poc_status = res.get("Status", "Review")
    if poc_status.upper() in ["PASSED", "PASS"]:
        db_status = "PASS"
        corrected_req = r.content
    else:
        db_status = "REVIEW"
        if correct_quality:
            # Extract rule violation info to feed back into POC correction logic
            failed_rules_list = res.get("Failed Rules", [])
            failed_rule_str = ", ".join(failed_rules_list) if isinstance(failed_rules_list, list) else str(failed_rules_list)
            
            # 2. Run POC correction logic
            _, _, _, corrected_req, _ = correct_single_requirement(
                index=idx,
                r=r,
                llm=llm,
                rag=rag,
                rag_context=rules_context,
                selected_collections="airam_guidelines",
                feedback_rule=failed_rule_str,
                feedback_rationale=res.get("Rationale"),
                custom_context=custom_context_correction
            )
        else:
            corrected_req = None
        
    failed_rules_list = res.get("Failed Rules", [])
    failed_rule_str = ", ".join(failed_rules_list) if isinstance(failed_rules_list, list) else str(failed_rules_list)
    
    return {
        "status": db_status,
        "failed_rule": failed_rule_str if failed_rule_str and failed_rule_str != "None" else None,
        "rationale": res.get("Rationale", "No explanation provided."),
        "corrected_req": corrected_req,
                    "swe1_id": None
    }

async def run_requirements_analysis_job(
    run_id: str,
    run_type: str,
    sys1_reqs_raw: list = None,
    sys2_reqs_raw: list = None,
    sys3_reqs_raw: list = None,
    swe1_reqs_raw: list = None,
    swe2_reqs_raw: list = None,
    guideline_id: str = None,
    project_name: str = None,
    use_rag: bool = False,
    model_name: str = "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    correct_quality: bool = False,
    correct_trace: bool = False,
    custom_context: str = None,
    custom_context_correction: str = None
):
    """Executes the analysis process row-by-row supporting Pause, Resume, Stop operations."""
    print(f"[TRACE] Job {run_id} starting. type={run_type}", flush=True)
    try:
        guideline_name = None
        if guideline_id:
            from backend.database import get_guideline_details
            g_details = get_guideline_details(guideline_id)
            if g_details:
                guideline_name = g_details["name"]
                
        save_execution_run(run_id, run_type, "running", guideline_name=guideline_name, project_name=project_name)
        ACTIVE_JOBS[run_id] = {
            "status": "running",
            "current_row": 0,
            "total_rows": 0
        }
        
        # Initialize LLMManager using passed model
        llm_manager = LLMManager(model_name=model_name, analysis_model_name=model_name)
        print(f"[TRACE] LLM initialized. API key present: {llm_manager.client.api_key != 'mock-key'}", flush=True)
        
        def make_req_objects(raw_list, category_name):
            reqs = []
            for idx, item in enumerate(raw_list or []):
                req = Requirement(
                    name=item.get("id", f"{category_name.upper()}-{idx+1}"),
                    content=item.get("text", ""),
                    state=item.get("state", item.get("State", "")),
                    asil=item.get("asil", item.get("ASIL", "")),
                    rationale=item.get("rationale", item.get("Rationale", "")),
                    covers=item.get("covers", item.get("Covers", item.get("Mapped_SWE1_ID", item.get("mapped_swe1_id", ""))))
                )
                req.category = category_name
                reqs.append(req)
            return reqs

        sys1_reqs = make_req_objects(sys1_reqs_raw, "sys1")
        sys2_reqs = make_req_objects(sys2_reqs_raw, "sys2")
        sys3_reqs = make_req_objects(sys3_reqs_raw, "sys3")
        swe1_reqs = make_req_objects(swe1_reqs_raw, "swe1")
        swe2_reqs = make_req_objects(swe2_reqs_raw, "swe2")
        
        print(f"[TRACE] Loaded SYS1: {len(sys1_reqs)}, SYS2: {len(sys2_reqs)}, SYS3: {len(sys3_reqs)}, SWE1: {len(swe1_reqs)}, SWE2: {len(swe2_reqs)}", flush=True)
        
        # Determine what we are analyzing
        analysis_items = []
        mode = "quality"
        
        if "traceability" in run_type:
            pairs_to_trace = [
                ("sys1", sys1_reqs, "sys2", sys2_reqs),
                ("sys2", sys2_reqs, "sys3", sys3_reqs),
                ("sys3", sys3_reqs, "swe1", swe1_reqs),
                ("swe1", swe1_reqs, "swe2", swe2_reqs),
            ]
            for parent_level, parent_reqs, child_level, child_reqs in pairs_to_trace:
                if parent_reqs and child_reqs:
                    for p in parent_reqs:
                        p.trace_parent_level = parent_level
                        p.trace_child_level = child_level
                        p.trace_child_reqs = child_reqs
                        analysis_items.append(p)
                else:
                    # Inject a single dummy requirement to indicate failure in UI
                    dummy = Requirement(name=f"MISSING_{parent_level.upper()}_OR_{child_level.upper()}", content="Dependency missing. Cannot perform traceability.", state="Missing", asil="-", rationale="-")
                    dummy.trace_parent_level = parent_level
                    dummy.trace_child_level = child_level
                    dummy.trace_child_reqs = []
                    dummy.is_missing_dependency = True
                    analysis_items.append(dummy)
            mode = "traceability"
        else:
            # For quality or combined analysis, process all requirements across all levels
            analysis_items = sys1_reqs + sys2_reqs + sys3_reqs + swe1_reqs + swe2_reqs
            mode = "quality"
            
        total_rows = len(analysis_items)
        print(f"[TRACE] Mode={mode}, total_rows={total_rows}", flush=True)
        
        if run_id in ACTIVE_JOBS:
            ACTIVE_JOBS[run_id]["total_rows"] = total_rows
        update_execution_progress(run_id, current_row=0, total_rows=total_rows, status="running")
        
        # 2. Inject strict guidelines content globally if strict guidelines mode is chosen
        is_strict_json = (guideline_id is not None and guideline_id.strip() != "" and not use_rag)
        if is_strict_json:
            try:
                ids = [i.strip() for i in guideline_id.split(",") if i.strip()]
                combined_rules = {}
                for gid in ids:
                    g_details = get_guideline_details(gid)
                    if g_details:
                        combined_rules[g_details["name"]] = g_details["content"]
                qa_mod.CURRENT_RULES = combined_rules
            except Exception as e:
                print(f"Failed to load strict guidelines {guideline_id}: {e}")
                qa_mod.CURRENT_RULES = None
        else:
            qa_mod.CURRENT_RULES = None
            
        # Loop and analyze row-by-row
        covered_child_ids = set()
        for idx, r in enumerate(analysis_items):
            print(f"[TRACE] Processing row {idx+1}/{total_rows}: {r.name}", flush=True)
            
            # Handle Pause/Stop operations
            while True:
                status_db = get_execution_status(run_id) or "stopped"
                if run_id in ACTIVE_JOBS:
                    ACTIVE_JOBS[run_id]["status"] = status_db
                
                if status_db == "stopped":
                    update_execution_status(run_id, "stopped")
                    qa_mod.CURRENT_RULES = None
                    print(f"[TRACE] Job {run_id} stopped by user at row {idx+1}", flush=True)
                    return
                if status_db == "paused":
                    await asyncio.sleep(0.5)
                    continue
                break
                
            if run_id in ACTIVE_JOBS:
                ACTIVE_JOBS[run_id]["current_row"] = idx + 1
            update_execution_progress(run_id, current_row=idx + 1, total_rows=total_rows)
            
            # Determine initial placeholder keys
            if mode == "traceability":
                parent_level = getattr(r, "trace_parent_level", "sys1")
                child_level = getattr(r, "trace_child_level", "sys2")
                cat = f"traceability:{parent_level}_to_{child_level}"
                row_id = create_placeholder_result(run_id, None, None, category=cat)
                update_execution_result_by_id(
                    row_id=row_id,
                    status="PROCESSING",
                    failed_rule=None,
                    rationale=f"Analyzing trace for {r.name} ({parent_level}->{child_level})... waiting for LLM/deterministic response",
                    corrected_req=None,
                    swe1_id=r.name,
                    swe1_text=r.content,
                    category=cat
                )
            else:
                row_id = create_placeholder_result(run_id, r.name, r.content, category=getattr(r, "category", None))
                
            # Update progress bar state
            if run_id in ACTIVE_JOBS:
                ACTIVE_JOBS[run_id]["current_row"] = idx + 1
            update_execution_progress(run_id, current_row=idx + 1, total_rows=total_rows)
            
            # Resolve rules context: fetch from RAG similarity search if enabled
            rules_context = ""
            if use_rag and r.content:
                try:
                    # Query RAGEngine
                    rules_context = rag_engine.query(r.content, collection_name="airam_guidelines", top_k=2)
                except Exception as e:
                    print(f"RAG rules search failed: {e}")
                    
            # Analyze using LLM or local fallbacks based on mode
            if mode == "traceability":
                parent_level = getattr(r, "trace_parent_level", "sys1")
                child_level = getattr(r, "trace_child_level", "sys2")
                child_reqs = getattr(r, "trace_child_reqs", [])
                
                if getattr(r, "is_missing_dependency", False):
                    update_execution_result_by_id(
                        row_id=row_id,
                        status="FAIL",
                        failed_rule="Missing Dependency",
                        rationale=f"Cannot execute traceability analysis for {parent_level.upper()} to {child_level.upper()} because one or both sets of requirements are missing.",
                        corrected_req=None,
                        swe1_id="-",
                        swe1_text="-",
                        category=f"traceability:{parent_level}_to_{child_level}"
                    )
                    continue
                
                print(f"[TRACE]   Using LLM for {r.name} ({parent_level}->{child_level})...", flush=True)
                result = await asyncio.to_thread(analyze_traceability_generic_with_llm, r, child_reqs, parent_level, child_level, llm_manager)
                print(f"[TRACE]   LLM returned: status={result.get('status')}, linked_ids={result.get('linked_child_ids', [])}", flush=True)
                status = result.get("status", "FAIL")
                rationale = result.get("rationale", "No explanation provided.")
                linked_ids = result.get("linked_child_ids", [])
                linked_children = [c for c in child_reqs if c.name in linked_ids]
                
                # Format outputs
                child_ids_str = ", ".join([c.name for c in linked_children]) if linked_children else None
                child_texts_str = "\n".join([f"• {c.name}: {c.content}" for c in linked_children]) if linked_children else None
                
                # Track covered
                for c in linked_children:
                    covered_child_ids.add(c.name)
                
                # Run traceability correction if enabled and status is FAIL/REVIEW
                corrected_req = None
                if correct_trace and status in ["FAIL", "REVIEW"]:
                    print(f"[TRACE]   Running traceability correction for {r.name}...", flush=True)
                    corrected_req = await asyncio.to_thread(
                        correct_traceability_requirement,
                        r, linked_children, status, rationale, child_reqs, parent_level, child_level, llm_manager,
                        custom_context_correction
                    )
                    if corrected_req:
                        print(f"[TRACE]   Correction generated for {r.name}: {corrected_req[:80]}...", flush=True)
                    
                update_execution_result_by_id(
                    row_id=row_id,
                    status=status,
                    failed_rule=None,
                    rationale=rationale,
                    corrected_req=corrected_req,
                    swe1_id=r.name,
                    swe1_text=r.content,
                    req_id=child_ids_str,
                    input_req=child_texts_str,
                    category=f"traceability:{parent_level}_to_{child_level}"
                )
            else:
                # Call quality auditor
                result = await asyncio.to_thread(analyze_quality, idx, r, llm_manager, rag_engine, rules_context, is_strict_json, correct_quality, custom_context, custom_context_correction)
                status = result.get("status", "REVIEW").upper()
                failed_rule = result.get("failed_rule")
                rationale = result.get("rationale", "No explanation provided.")
                corrected_req = result.get("corrected_req", r.content)
                
                update_execution_result_by_id(
                    row_id=row_id,
                    status=status,
                    failed_rule=failed_rule,
                    rationale=rationale,
                    corrected_req=corrected_req,
                    swe1_id=None,
                    swe1_text=None
                )
                
            print(f"[TRACE]   Row {idx+1} done: status={status}", flush=True)
            # Yield execution control to remain responsive
            await asyncio.sleep(0.01)
            
        if mode == "traceability":
            # Process orphaned child requirements
            orphan_count = 0
            for c in child_reqs:
                if c.name not in covered_child_ids:
                    orphan_count += 1
                    row_id = create_placeholder_result(run_id, c.name, c.content, category="traceability")
                    
                    # Run orphan correction if enabled
                    orphan_corrected = None
                    if correct_trace:
                        print(f"[TRACE]   Running orphan correction for {c.name}...", flush=True)
                        orphan_corrected = await asyncio.to_thread(
                            correct_orphaned_swe2,
                            c, primary_parent_reqs, llm_manager,
                            custom_context_correction
                        )
                        if orphan_corrected:
                            print(f"[TRACE]   Orphan correction generated for {c.name}: {orphan_corrected[:80]}...", flush=True)
                    
                    update_execution_result_by_id(
                        row_id=row_id,
                        status="FAIL",
                        failed_rule="Orphan Requirement",
                        rationale="Orphaned Item: No linked parent requirement found.",
                        corrected_req=orphan_corrected,
                        swe1_id=None,
                        swe1_text=None,
                        category="traceability"
                    )
            print(f"[TRACE] Orphaned child requirements: {orphan_count}", flush=True)
                    
        update_execution_progress(run_id, current_row=total_rows, total_rows=total_rows, status="completed")
        if run_id in ACTIVE_JOBS:
            ACTIVE_JOBS[run_id]["status"] = "completed"
            ACTIVE_JOBS[run_id]["current_row"] = total_rows
        # Reset rules state
        qa_mod.CURRENT_RULES = None
        print(f"[TRACE] Job {run_id} COMPLETED successfully.", flush=True)
    except Exception as e:
        import traceback
        print(f"[ERROR] Job {run_id} CRASHED: {e}", flush=True)
        traceback.print_exc()
        # Mark the job as stopped in DB so frontend stops polling
        try:
            update_execution_progress(run_id, current_row=0, total_rows=0, status="stopped")
        except Exception:
            pass
        if run_id in ACTIVE_JOBS:
            ACTIVE_JOBS[run_id]["status"] = "stopped"
        qa_mod.CURRENT_RULES = None

