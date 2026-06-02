"""Stop hook: block when code files were edited but no reviewer agent was spawned."""

import json
import sys
from pathlib import Path

_EDIT_TOOLS = frozenset({"Edit", "Write"})

# Source-code suffixes (allowlist). Editing docs/config/data does not gate.
_CODE_SUFFIXES = frozenset(
    {
        ".py", ".pyi",
        ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
        ".go", ".rs", ".java", ".kt", ".kts", ".scala",
        ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh",
        ".cs", ".rb", ".php", ".swift", ".m", ".mm",
        ".lua", ".r", ".jl", ".dart", ".ex", ".exs", ".erl", ".hs",
        ".sh", ".bash", ".zsh", ".sql", ".vue", ".svelte",
    }
)


def check(transcript_path: str) -> dict:
    """Return edited code files and whether any reviewer ran this turn."""
    entries = _load_transcript(transcript_path)
    turn = _current_turn(entries)
    code_files = _edited_code_files(turn)
    reviewed = _reviewer_spawned(turn)
    return {"code_files": sorted(code_files), "reviewed": reviewed}


def _load_transcript(path: str) -> list[dict]:
    entries: list[dict] = []
    for line in Path(path).read_text(encoding="utf-8").split("\n"):
        if not line.strip():
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return entries


def _current_turn(entries: list[dict]) -> list[dict]:
    """Entries since the last real user prompt."""
    turn: list[dict] = []
    for entry in reversed(entries):
        content = (entry.get("message") or {}).get("content")
        if entry.get("type") == "user" and isinstance(content, str):
            break
        turn.append(entry)
    turn.reverse()
    return turn


def _edited_code_files(turn: list[dict]) -> set[str]:
    """Collect code file paths touched by Edit/Write in this turn."""
    paths: set[str] = set()
    for entry in turn:
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if block.get("type") != "tool_use":
                continue
            if block.get("name") not in _EDIT_TOOLS:
                continue
            file_path = (block.get("input") or {}).get("file_path", "")
            if Path(file_path).suffix.lower() in _CODE_SUFFIXES:
                paths.add(file_path)
    return paths


def _reviewer_spawned(turn: list[dict]) -> bool:
    """True if any *-reviewer agent was spawned this turn (any one passes)."""
    for entry in turn:
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if block.get("type") != "tool_use" or block.get("name") != "Agent":
                continue
            agent_type = (block.get("input") or {}).get("subagent_type", "")
            if agent_type.endswith("-reviewer"):
                return True
    return False


def _block_decision(result: dict) -> dict | None:
    if not result["code_files"] or result["reviewed"]:
        return None
    listed = "\n".join(f"  - {p}" for p in result["code_files"])
    reason = (
        f"You edited code but ran no reviewer:\n{listed}\n"
        "Before responding, review what you wrote: spawn the appropriate *-reviewer "
        "agent(s) for the changes (eg. craft-reviewer, comment-reviewer, change-reviewer). "
        "For large or wide-ranging changes, invoke the basic-engineering:review-board skill "
        "instead -- it fans out to every reviewer. Running any one reviewer satisfies this check."
    )
    return {"decision": "block", "reason": reason}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw)
        result = check(hook_input["transcript_path"])
    except Exception:
        return
    decision = _block_decision(result)
    if decision is not None:
        print(json.dumps(decision, ensure_ascii=False))


if __name__ == "__main__":
    main()
