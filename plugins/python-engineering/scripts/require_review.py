"""Stop hook: block when Python files were edited but the reviewer was not spawned."""

import json
import sys
from pathlib import Path

_EDIT_TOOLS = frozenset({"Edit", "Write"})
_REVIEWER_AGENT = "python-change-reviewer"


def check(transcript_path: str) -> dict:
    """Return edited .py files and whether the reviewer ran this turn."""
    entries = _load_transcript(transcript_path)
    turn = _current_turn(entries)
    py_files = _edited_py_files(turn)
    reviewed = _reviewer_spawned(turn)
    return {"py_files": sorted(py_files), "reviewed": reviewed}


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


def _edited_py_files(turn: list[dict]) -> set[str]:
    """Collect .py file paths touched by Edit/Write in this turn."""
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
            if file_path.endswith(".py"):
                paths.add(file_path)
    return paths


def _reviewer_spawned(turn: list[dict]) -> bool:
    """True if the python-change-reviewer agent was spawned this turn."""
    for entry in turn:
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if block.get("type") != "tool_use" or block.get("name") != "Agent":
                continue
            agent_type = (block.get("input") or {}).get("subagent_type", "")
            if _REVIEWER_AGENT in agent_type:
                return True
    return False


def _block_decision(result: dict) -> dict | None:
    if not result["py_files"] or result["reviewed"]:
        return None
    listed = "\n".join(f"  - {p}" for p in result["py_files"])
    reason = (
        f"You edited Python files but did not run the python-change-reviewer:\n{listed}\n"
        "Spawn the python-engineering:python-change-reviewer agent now to review "
        "these changes before responding to the user."
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
