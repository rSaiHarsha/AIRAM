"""
AIRAM Copilot Orchestration Engine
----------------------------------
Routes user questions through a tool-calling loop against AIRAM's existing
requirements / quality / traceability / RAG data, then synthesizes a final answer.
"""

import json
import random
import re
import time

from Model.llm import LLMManager
from Copilot.tools import (
    TOOL_SCHEMAS,
    dispatch_tool,
    is_empty_result,
    _clean_for_llm,
)

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

User: Summarize the requirements.
Assistant: <ask question> Which level of requirements would you like me to summarize? (e.g., SYS.1, SYS.2, SYS.3, SWE.1, SWE.2)

User: Summarize SYS.1 requirements.
Assistant: call get_all_requirements_by_type(req_type="sys1")

Always call a tool to fetch real data before answering factual questions about
requirements, traceability, or analysis results. Never invent requirement IDs,
statuses, or rule names — only report what tools return. If a question needs
multiple lookups (e.g. "orphans and their risk"), call tools in sequence.
If the user asks to perform an action on requirements (like summarizing or listing) but does not specify the type (e.g. SYS.1, SWE.1, etc.), you MUST ask them to clarify by providing them with options (SYS.1, SYS.2, SYS.3, SWE.1, SWE.2). 
If the user asks to fetch or summarize strict guidelines, use `list_guideline_files` to show the available documents as options, wait for their selection, then use `fetch_guideline_content` to fetch the full rules text of the selected document.
If the user asks about previous execution runs, history, or which guideline/rules were used in a past quality/correction run, use `get_previous_runs_info` to find the run history and the guideline name. If they want the details of that guideline, you can then call `fetch_guideline_content` with that name.
If the user asks for a UML diagram (use case, class, sequence, or activity diagram), use `generate_uml_diagram` with the appropriate diagram_type. You can optionally specify which requirement types to include (e.g. req_types='swe1,swe2'). After the tool returns, describe the generated diagram briefly.
If no tool result answers the question, say so plainly."""

MAX_TOOL_HOPS = 4
MAX_HISTORY_MESSAGES = 12  # bound context growth across a long chat session

SMALL_TOOL_MODEL = "nvidia/nemotron-nano-12b-v2-vl"
LARGE_SYNTHESIS_MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1.5"

THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _strip_reasoning(text: str) -> str:
    """Remove <think>...</think> chain-of-thought blocks emitted by reasoning models."""
    if not text:
        return text
    return THINK_BLOCK_RE.sub("", text).strip()


def _retry_call(create_fn, *, max_retries=3, base_delay=1.0, **kwargs):
    """Local exponential-backoff wrapper for LLM API calls."""
    last_err = None
    for attempt in range(max_retries):
        try:
            return create_fn(**kwargs)
        except Exception as e:
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
Search for braking requirements -> TOOL
Generate a use case diagram -> TOOL
Create a sequence diagram from requirements -> TOOL"""
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
            
            # Check if any tool result contains UML image data
            image_base64 = None
            plantuml_code = None
            for tr in last_tool_results:
                try:
                    parsed = json.loads(tr)
                    if isinstance(parsed, dict) and parsed.get("image_base64"):
                        image_base64 = parsed["image_base64"]
                        plantuml_code = parsed.get("plantuml_code", "")
                        break
                except (json.JSONDecodeError, TypeError):
                    pass
            
            if image_base64:
                yield {"type": "image", "image_base64": image_base64, "plantuml_code": plantuml_code, "text": final_text}
                print(f"[Copilot Final Answer] Model: '{target_model}' | Output Length: {len(final_text)} chars | Has Image: True", flush=True)
            else:
                print(f"[Copilot Final Answer] Model: '{target_model}' | Output Length: {len(final_text)} chars", flush=True)
                yield {"type": "final", "text": final_text}
            print(f"==================== [COPILOT TURN END] ====================\n", flush=True)
            return

        except Exception as e:
            print(f"[Copilot Engine Exception] {e}", flush=True)
            print(f"==================== [COPILOT TURN END (ERROR)] ====================\n", flush=True)
            yield {"type": "error", "text": f"An error occurred while generating a response: {e}"}
            return

    print(f"[Copilot Max Hops Reached] Hit limit of {MAX_TOOL_HOPS} hops.", flush=True)
    print(f"==================== [COPILOT TURN END (LIMIT)] ====================\n", flush=True)
    yield {"type": "error", "text": "Copilot hit the maximum number of tool hops without reaching a conclusion."}