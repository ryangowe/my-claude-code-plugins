"""Stop hook: gate code edits on a review -- any reviewer if proactive, else the review-board skill."""

import json
import sys
from pathlib import Path

_EDIT_TOOLS = frozenset({"Edit", "Write"})

# The harness injects a prior block as a user message starting with this text.
_STOP_FEEDBACK_PREFIX = "Stop hook feedback:"

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
    """Return edited code files and whether this turn's review is sufficient.

    Until the gate first blocks, any reviewer counts -- a review done while writing.
    Once it has blocked, the stop-without-review is after-the-fact, so only the
    review-board skill counts: no self-picked single reviewer.
    """
    entries = _load_transcript(transcript_path)
    turn = _current_turn(entries)
    code_files = _edited_code_files(turn)
    if _blocked_before(turn):
        reviewed = _review_board_invoked(turn)
    else:
        reviewed = _reviewer_spawned(turn) or _review_board_invoked(turn)
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
    """Entries since the last real user prompt.

    A prior Stop-hook block is injected as a user string but is not a real prompt, so it
    does not start a new turn -- the edits it gated stay in scope on re-check.
    """
    turn: list[dict] = []
    for entry in reversed(entries):
        content = (entry.get("message") or {}).get("content")
        if entry.get("type") == "user" and isinstance(content, str):
            if content.startswith(_STOP_FEEDBACK_PREFIX):
                turn.append(entry)
                continue
            break
        turn.append(entry)
    turn.reverse()
    return turn


def _blocked_before(turn: list[dict]) -> bool:
    """True if this gate already blocked earlier in the turn."""
    for entry in turn:
        content = (entry.get("message") or {}).get("content")
        if (
            entry.get("type") == "user"
            and isinstance(content, str)
            and content.startswith(_STOP_FEEDBACK_PREFIX)
        ):
            return True
    return False


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
    """True if any *-reviewer agent was spawned this turn."""
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


def _review_board_invoked(turn: list[dict]) -> bool:
    """True if the review-board skill was invoked this turn."""
    for entry in turn:
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if block.get("type") != "tool_use" or block.get("name") != "Skill":
                continue
            skill = (block.get("input") or {}).get("skill", "")
            if skill.endswith("review-board"):
                return True
    return False


def _block_decision(result: dict) -> dict | None:
    if not result["code_files"] or result["reviewed"]:
        return None
    listed = "\n".join(f"  - {p}" for p in result["code_files"])
    reason = (
        f"You are stopping with edited code that was never reviewed:\n{listed}\n"
        "Because the review is now after the fact, run the basic-engineering:review-board skill "
        "-- it fans out to every available *-reviewer. A single self-picked reviewer will not "
        "clear this; no downgrade. Going forward, review as you write: run the one relevant "
        "*-reviewer for a small, focused change, and review-board for a large or wide-ranging one."
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
