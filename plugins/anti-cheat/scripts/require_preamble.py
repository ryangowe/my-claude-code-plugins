"""PreToolUse hook: block Edit/Write/Bash until the assistant has spoken in text first.

Before any Edit, Write, or Bash call in a turn, Claude should emit a one-sentence
text message stating what it is about to do. This hook inspects the current turn
(everything since the last real user prompt) and denies the tool call when no
assistant text block has been produced yet. Once Claude has said something, the
rest of the turn can call tools freely -- the gate is only on the first
unannounced Edit/Write/Bash.

PreToolUse 钩子：除非助手先用文本说话，否则拦截 Edit/Write/Bash。
每一轮里调用 Edit、Write 或 Bash 之前，Claude 应当先输出一句文本，说明自己接下来要做什么。
本钩子检查当前一轮（自上一次真实的用户提问以来的全部条目），当尚无任何助手文本块出现时，
拒绝该工具调用。一旦 Claude 说过话，本轮之后的工具调用就可以自由进行——这道闸门只针对
本轮里第一次未经预告的 Edit/Write/Bash。
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

_GATED_TOOLS = frozenset({"Edit", "Write", "Bash"})
_HOOK_INPUT_FIELDS = (
    "hook_event_name",
    "session_id",
    "tool_name",
    "transcript_path",
)
_RAW_STDIN_LIMIT = 2000


def check(transcript_path: str) -> dict:
    """Return whether this turn already contains an assistant text block."""
    entries = _load_transcript(transcript_path)
    turn = _current_turn(entries)
    return {"has_text": _turn_has_text(turn)}


def _load_transcript(path: str) -> list[dict]:
    """Parse a JSONL transcript; unparseable lines are dropped."""
    entries: list[dict] = []
    # JSONL is newline-delimited; str.splitlines() would also break on other Unicode boundaries
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

    A prompt and a tool_result are both ``type: "user"``; only the prompt carries
    string content, so a string-content user entry is what bounds the turn.
    """
    turn: list[dict] = []
    for entry in reversed(entries):
        content = (entry.get("message") or {}).get("content")
        if entry.get("type") == "user" and isinstance(content, str):
            break
        turn.append(entry)
    turn.reverse()
    return turn


def _turn_has_text(turn: list[dict]) -> bool:
    """True when some assistant entry in this turn has a non-empty text block."""
    for entry in turn:
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if block.get("type") == "text" and (block.get("text") or "").strip():
                return True
    return False


def _capture_path() -> Path | None:
    """The JSONL capture file, or None when CLAUDE_PLUGIN_DATA is unset."""
    # CLAUDE_PLUGIN_DATA is the only dir Claude Code persists across plugin updates; without
    # it there is nowhere safe to write, so we skip capturing rather than guess a location.
    base = os.environ.get("CLAUDE_PLUGIN_DATA")
    return Path(base) / "anti-cheat-preamble.jsonl" if base else None


def _append(record: dict) -> None:
    """Append one record to the capture file; a no-op when there is no capture path."""
    path = _capture_path()
    if path is None:
        return
    line = json.dumps(record, ensure_ascii=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("ab") as f:
        f.write(line.encode("utf-8", errors="replace"))


def _deny(tool_name: str, result: dict) -> dict | None:
    """A PreToolUse ``deny`` payload telling Claude to speak first, or None when ok."""
    if tool_name not in _GATED_TOOLS:
        return None
    if result.get("has_text"):
        return None
    reason = (
        f"You called {tool_name} without first telling the user what you are about "
        "to do. Before any Edit, Write, or Bash call in a turn, emit a one-sentence "
        "text message stating what you are about to do. Write that sentence now, "
        "then call the tool again."
    )
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def main() -> None:
    """PreToolUse entry point: deny gated tools until the turn has an assistant text block."""
    sys.stdout.reconfigure(encoding="utf-8")
    raw = sys.stdin.read()
    record: dict = {"captured_at": datetime.now().isoformat()}
    tool_name = ""
    try:
        hook_input = json.loads(raw)
        record["hook_input"] = {key: hook_input.get(key) for key in _HOOK_INPUT_FIELDS}
        record["check"] = check(hook_input["transcript_path"])
        tool_name = hook_input.get("tool_name", "")
    except Exception as exc:
        record["error"] = f"{type(exc).__name__}: {exc}"
        record["raw_stdin"] = raw[:_RAW_STDIN_LIMIT]
    try:
        _append(record)
    except Exception:  # a hook must never disrupt Claude, even when its own logging fails
        pass
    payload = _deny(tool_name, record.get("check", {}))
    if payload is not None:
        print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
