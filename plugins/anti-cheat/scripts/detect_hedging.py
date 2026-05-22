"""Stop hook: detect hedging patterns that signal hallucination.

Short clauses containing transitional conjunctions like "A but B" suggest the
LLM is papering over uncertainty.  When detected the hook blocks the stop and
forces a re-research; the re-answer is rechecked the same way.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import jieba

_HEDGE_CONJUNCTIONS = frozenset({
    "but", "however", "nevertheless", "nonetheless", "yet",
    "although", "though", "whereas", "while",
    "不过", "但是", "但", "然而", "却", "虽然", "尽管",
})
_CLAUSE_SEPARATORS = frozenset({",", "，", ";", "；"})
_MAX_WORD_COUNT = 10
_HOOK_INPUT_FIELDS = ("hook_event_name", "session_id", "stop_hook_active", "transcript_path")
_RAW_STDIN_LIMIT = 2000


def detect(transcript_path: str) -> dict:
    """Find hedging clauses in the current turn's assistant text."""
    text = _last_turn_text(_load_transcript(transcript_path))
    clauses = _split_clauses(text)
    flagged = [c for c in clauses if _is_hedging(c)]
    return {"text": text, "flagged_clauses": flagged}


def _load_transcript(path: str) -> list[dict]:
    """Parse a JSONL transcript; unparseable lines become ``{"type": "_unparseable"}``."""
    entries: list[dict] = []
    for line in Path(path).read_text(encoding="utf-8").split("\n"):
        if not line.strip():
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            entries.append({"type": "_unparseable"})
    return entries


def _last_turn_text(entries: list[dict]) -> str:
    """Assistant text emitted since the last real user prompt.

    A prompt and a tool_result are both ``type: "user"``; only the prompt carries
    string content, so a string-content user entry is what bounds the turn.
    """
    texts: list[str] = []
    for entry in reversed(entries):
        content = (entry.get("message") or {}).get("content")
        if entry.get("type") == "user" and isinstance(content, str):
            break
        if entry.get("type") == "assistant" and isinstance(content, list):
            texts += [block["text"] for block in content if block.get("type") == "text"]
    texts.reverse()
    return "\n\n".join(texts)


def _split_clauses(text: str) -> list[str]:
    """Split text into clauses at comma-level separators using jieba tokens."""
    tokens = list(jieba.cut(text))
    clauses: list[str] = []
    current: list[str] = []
    for token in tokens:
        if token.strip() in _CLAUSE_SEPARATORS:
            clause = "".join(current).strip()
            if clause:
                clauses.append(clause)
            current = []
        else:
            current.append(token)
    tail = "".join(current).strip()
    if tail:
        clauses.append(tail)
    return clauses


def _is_hedging(clause: str) -> bool:
    """True when a short clause contains a hedging conjunction."""
    words = list(jieba.cut(clause))
    content_words = [w for w in words if w.strip()]
    if len(content_words) >= _MAX_WORD_COUNT:
        return False
    return any(w.strip().lower() in _HEDGE_CONJUNCTIONS for w in words)


def _capture_path() -> Path | None:
    """The JSONL capture file, or None when CLAUDE_PLUGIN_DATA is unset."""
    # CLAUDE_PLUGIN_DATA is the only dir Claude Code persists across plugin updates; without
    # it there is nowhere safe to write, so we skip capturing rather than guess a location.
    base = os.environ.get("CLAUDE_PLUGIN_DATA")
    return Path(base) / "anti-cheat-hedging.jsonl" if base else None


def _append(record: dict) -> None:
    """Append one record to the capture file; a no-op when there is no capture path."""
    path = _capture_path()
    if path is None:
        return
    line = json.dumps(record, ensure_ascii=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("ab") as f:
        f.write(line.encode("utf-8", errors="replace"))


def _block_decision(result: dict) -> dict | None:
    """A Stop ``block`` decision listing the hedging clauses, or None when clean."""
    flagged = result.get("flagged_clauses", [])
    if not flagged:
        return None
    listed = "\n".join(f"  - \"{clause}\"" for clause in flagged)
    reason = (
        f"These clauses in your last message contain hedging patterns:\n{listed}\n"
        "Short hedged statements like 'X but Y' suggest you are uncertain and "
        "may be hallucinating. Re-research the topic using your tools before "
        "answering. Do not rely on vague claims — verify the facts or say you "
        "don't know."
    )
    return {"decision": "block", "reason": reason}


def main() -> None:
    """Stop hook entry point: detect hedging in the assistant turn; block on suspicion."""
    sys.stdout.reconfigure(encoding="utf-8")
    raw = sys.stdin.read()
    record: dict = {"captured_at": datetime.now().isoformat()}
    try:
        hook_input = json.loads(raw)
        record["hook_input"] = {key: hook_input.get(key) for key in _HOOK_INPUT_FIELDS}
        record["detect"] = detect(hook_input["transcript_path"])
    except Exception as exc:
        record["error"] = f"{type(exc).__name__}: {exc}"
        record["raw_stdin"] = raw[:_RAW_STDIN_LIMIT]
    try:
        _append(record)
    except Exception:
        pass
    decision = _block_decision(record.get("detect", {}))
    if decision is not None:
        print(json.dumps(decision, ensure_ascii=False))


if __name__ == "__main__":
    main()
