import json
from typing import List, Dict, Any
from Model.requirement import Requirement
from Analysis.quality_analyser import clean_and_parse_json



def analyze_traceability_from_swe1_with_llm(r_swe1: Requirement, swe2_reqs: list, llm) -> dict:
    """Calls Nvidia NIM API to analyze which SWE.2 requirements trace to a given SWE.1 requirement."""
    if not llm or not llm.client.api_key or llm.client.api_key == "mock-key":
        return {"status": "FAIL", "linked_swe2_ids": [], "rationale": "No LLM API key configured for semantic search."}

    # Build list of SWE.2 requirements for prompt context
    srs_list_str = "\n".join([f"- {srs.name}: {srs.content}" for srs in swe2_reqs[:100]]) # Limit to prevent context blowup
    
    system_prompt = (
        "You are an automotive safety and systems engineer. Evaluate which of the following Low-Level Software Requirements (SWE.2) "
        "properly trace to and satisfy the High-Level Requirement (SWE.1) listed below. "
        "Respond ONLY in a structured JSON format containing the following fields:\n"
        "{\n"
        '  "status": "PASS" | "FAIL" | "REVIEW",\n'
        '  "linked_swe2_ids": ["SWE2_0001", "SWE2_0002", ...] or [],\n'
        '  "rationale": "Reason why they trace or do not trace"\n'
        "}"
    )
    user_content = f"SWE.2 Requirements available:\n{srs_list_str}\n\nSWE.1 Requirement to match:\nID: {r_swe1.name}\nContent: {r_swe1.content}"
    
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = llm.get_response(messages, stream=False, model=getattr(llm, "analysis_model_name", "nvidia/llama-3.3-nemotron-super-49b-v1.5"))
        res_data = clean_and_parse_json(response.choices[0].message.content)
        
        status_raw = res_data.get("status", "REVIEW").upper()
        linked_ids = res_data.get("linked_swe2_ids", [])
        if not isinstance(linked_ids, list):
            linked_ids = [linked_ids] if linked_ids else []
            
        return {
            "status": "PASS" if status_raw in ["PASS", "PASSED"] and len(linked_ids) > 0 else ("REVIEW" if status_raw == "REVIEW" else "FAIL"),
            "linked_swe2_ids": linked_ids,
            "rationale": res_data.get("rationale", "No rationale provided by LLM.")
        }
    except Exception as e:
        print(f"Nvidia NIM API traceability call failed: {e}")
        return {
            "status": "FAIL",
            "linked_swe2_ids": [],
            "rationale": f"LLM analysis failed: {str(e)}"
        }

def compare_traceability(swe1_reqs: List[Requirement], swe2_reqs: List[Requirement], llm=None) -> Dict[str, Any]:
    """
    Build bidirectional mapping links between SWE.1 (HLD) and SWE.2 (LLD) using AI.
    """
    metrics = {
        "total_hld": len(swe1_reqs),
        "covered_count": 0,
        "orphaned_count": 0,
        "coverage_pct": 0
    }
    table = []

    covered_swe2 = set()
    covered_swe1 = set()

    for r1 in swe1_reqs:
        # Call LLM for semantic links
        result = analyze_traceability_from_swe1_with_llm(r1, swe2_reqs, llm)
        status = result.get("status", "FAIL")
        rationale = result.get("rationale", "No explanation provided.")
        linked_ids = result.get("linked_swe2_ids", [])
        linked_swe2s = [s2 for s2 in swe2_reqs if s2.name in linked_ids]
        
        if linked_swe2s:
            covered_swe1.add(r1.name)
            for s2 in linked_swe2s:
                covered_swe2.add(s2.name)
                
            table.append({
                "swe1_id": r1.name,
                "swe1_content": r1.content,
                "swe2_id": ", ".join([s2.name for s2 in linked_swe2s]),
                "swe2_content": "\n".join([f"• {s2.name}: {s2.content}" for s2 in linked_swe2s]),
                "status": status,
                "rationale": rationale
            })
        else:
            table.append({
                "swe1_id": r1.name,
                "swe1_content": r1.content,
                "swe2_id": "-",
                "swe2_content": "-",
                "status": "FAIL",
                "rationale": rationale
            })

    # Process orphaned SWE.2 requirements
    for s2 in swe2_reqs:
        if s2.name not in covered_swe2:
            table.append({
                "swe1_id": "-",
                "swe1_content": "-",
                "swe2_id": s2.name,
                "swe2_content": s2.content,
                "status": "FAIL",
                "rationale": "Orphaned LLD: No linked SWE.1 requirement found."
            })

    metrics["covered_count"] = len(covered_swe1)
    metrics["orphaned_count"] = metrics["total_hld"] - metrics["covered_count"]
    if metrics["total_hld"] > 0:
        metrics["coverage_pct"] = round((metrics["covered_count"] / metrics["total_hld"]) * 100, 2)

    return {
        "metrics": metrics,
        "table": table
    }


def correct_traceability_requirement(
    r_swe1: Requirement,
    linked_swe2s: list,
    analysis_status: str,
    analysis_rationale: str,
    swe2_reqs: list,
    llm,
    custom_context: str = None
) -> str:
    """
    Generates or rewrites SWE.2 (LLR) requirements to improve traceability coverage
    for a given SWE.1 (HLR) requirement that has FAIL or REVIEW status.
    
    Returns corrected/new requirement text (newline-separated if multiple).
    """
    if not llm or not llm.client.api_key or llm.client.api_key == "mock-key":
        return None

    # Build context of existing linked SWE.2s (if any)
    linked_context = ""
    if linked_swe2s:
        linked_context = "\n".join([f"- {s2.name}: {s2.content}" for s2 in linked_swe2s])
        linked_context = f"\nCurrently linked SWE.2 requirements:\n{linked_context}"

    system_prompt = (
        "You are a Senior Automotive Systems Engineer and Requirements Expert.\n"
        "Based on the traceability analysis results, your task is to generate or rewrite "
        "Low-Level Software Requirements (SWE.2 / LLR) that properly trace to and satisfy "
        "the given High-Level Requirement (SWE.1 / HLR).\n\n"
        "You MUST adhere to these strict rules:\n"
        "1. Return ONLY valid JSON exactly matching the schema below.\n"
        "2. Do NOT include any explanation or markdown formatting outside the JSON.\n"
        "3. Each corrected requirement must be a complete, standalone requirement.\n"
        "4. Use EARS syntax patterns (ubiquitous, event-driven, state-driven) where applicable.\n"
        "5. Split into multiple requirements if the SWE.1 contains multiple aspects that need separate LLR coverage.\n"
        "6. Each requirement must be atomic, unambiguous, and verifiable.\n\n"
        "JSON Schema:\n"
        "{\n"
        "  \"split_required\": boolean,\n"
        "  \"corrected_requirements\": [string]\n"
        "}"
    )

    if custom_context:
        system_prompt += (
            "\n\nIn addition to the above rules, you MUST also conform to these custom criteria:\n"
            f"{custom_context}\n"
        )

    user_content = (
        f"SWE.1 High-Level Requirement:\n"
        f"ID: {r_swe1.name}\n"
        f"Content: {r_swe1.content}\n\n"
        f"Traceability Analysis Result: {analysis_status}\n"
        f"Analysis Rationale: {analysis_rationale}"
        f"{linked_context}\n\n"
    )

    if analysis_status == "FAIL" and not linked_swe2s:
        user_content += (
            "This SWE.1 requirement has NO linked SWE.2 requirements. "
            "Generate new SWE.2 Low-Level Requirements that would properly decompose and trace to this SWE.1."
        )
    else:
        user_content += (
            "The existing SWE.2 linkage is incomplete or has issues. "
            "Rewrite or generate additional SWE.2 requirements to fully satisfy and trace to this SWE.1."
        )

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = llm.get_response(
            messages, stream=False,
            model=getattr(llm, "analysis_model_name", "nvidia/llama-3.3-nemotron-super-49b-v1.5")
        )

        raw_response = response.choices[0].message.content.strip()

        try:
            data = clean_and_parse_json(raw_response)
            corrected_requirements = data.get("corrected_requirements", [])

            if corrected_requirements:
                return "\n".join(
                    req.strip() for req in corrected_requirements if req and req.strip()
                )
            return None
        except Exception:
            # Fallback: treat raw response as the corrected text
            if raw_response and not raw_response.startswith("{"):
                return raw_response
            return None

    except Exception as e:
        print(f"Traceability correction LLM call failed: {e}")
        return None


def correct_orphaned_swe2(
    orphaned_swe2: Requirement,
    swe1_reqs: list,
    llm,
    custom_context: str = None
) -> str:
    """
    Rewrites an orphaned SWE.2 requirement to better trace to one of the
    available SWE.1 requirements, or suggests which SWE.1 it should trace to.
    
    Returns corrected requirement text (newline-separated if multiple).
    """
    if not llm or not llm.client.api_key or llm.client.api_key == "mock-key":
        return None

    # Build context of available SWE.1 requirements
    swe1_context = "\n".join([f"- {r.name}: {r.content}" for r in swe1_reqs[:50]])

    system_prompt = (
        "You are a Senior Automotive Systems Engineer and Requirements Expert.\n"
        "An orphaned Low-Level Requirement (SWE.2 / LLR) has been identified that does not "
        "trace to any High-Level Requirement (SWE.1 / HLR).\n\n"
        "Your task is to rewrite this SWE.2 requirement so that it properly traces to "
        "the most relevant SWE.1 requirement from the list provided.\n\n"
        "You MUST adhere to these strict rules:\n"
        "1. Return ONLY valid JSON exactly matching the schema below.\n"
        "2. Do NOT include any explanation or markdown formatting outside the JSON.\n"
        "3. Each corrected requirement must be a complete, standalone requirement.\n"
        "4. Use EARS syntax patterns where applicable.\n"
        "5. Split into multiple requirements if the original contains multiple actions.\n\n"
        "JSON Schema:\n"
        "{\n"
        "  \"split_required\": boolean,\n"
        "  \"corrected_requirements\": [string]\n"
        "}"
    )

    if custom_context:
        system_prompt += (
            "\n\nIn addition to the above rules, you MUST also conform to these custom criteria:\n"
            f"{custom_context}\n"
        )

    user_content = (
        f"Orphaned SWE.2 Requirement:\n"
        f"ID: {orphaned_swe2.name}\n"
        f"Content: {orphaned_swe2.content}\n\n"
        f"Available SWE.1 Requirements:\n{swe1_context}\n\n"
        "Rewrite this orphaned SWE.2 requirement to properly trace to the most relevant SWE.1 above. "
        "If the requirement addresses multiple aspects, split it into separate atomic requirements."
    )

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = llm.get_response(
            messages, stream=False,
            model=getattr(llm, "analysis_model_name", "nvidia/llama-3.3-nemotron-super-49b-v1.5")
        )

        raw_response = response.choices[0].message.content.strip()

        try:
            data = clean_and_parse_json(raw_response)
            corrected_requirements = data.get("corrected_requirements", [])

            if corrected_requirements:
                return "\n".join(
                    req.strip() for req in corrected_requirements if req and req.strip()
                )
            return None
        except Exception:
            if raw_response and not raw_response.startswith("{"):
                return raw_response
            return None

    except Exception as e:
        print(f"Orphaned SWE.2 correction LLM call failed: {e}")
        return None
