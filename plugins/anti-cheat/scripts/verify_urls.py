"""Stop hook: verify the URLs in the final turn are reachable.

Extracts every assistant text block emitted since the last real user prompt --
the full text shown to the user this turn -- finds the URLs in it, and checks
each one over the network. Findings are appended to a JSONL capture file. When a
cited URL is unreachable the hook blocks the stop and makes Claude re-answer; the
re-answer is rechecked the same way, so the block holds until an answer cites no
unreachable URL. Claude Code force-stops a hook after 8 consecutive blocks.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

# real URLs are ASCII; an ASCII-only class stops the match at CJK text that follows without a space
_URL_PATTERN = re.compile(r"https?://[A-Za-z0-9._~:/?#@!$&*+,;=%-]+")
_TRAILING_PUNCTUATION = ".,;:!?"  # sentence marks the URL regex can over-capture
_TIMEOUT = 8.0
_USER_AGENT = "Mozilla/5.0 (compatible; anti-cheat-hook)"
_REACHABLE_HTTP_ERRORS = frozenset({401, 403, 429})  # answered, so the URL resolves
_MAX_WORKERS = 8
_HOOK_INPUT_FIELDS = ("hook_event_name", "session_id", "stop_hook_active", "transcript_path")
_RAW_STDIN_LIMIT = 2000


def _verify(transcript_path: str) -> dict:
    """Find the URLs in this turn's assistant text and check each one's reachability."""
    text = _last_turn_text(_load_transcript(transcript_path))
    urls = _find_urls(text)
    if not urls:
        return {"text": text, "urls": []}
    with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, len(urls))) as pool:
        return {"text": text, "urls": list(pool.map(_check_url, urls))}


def _load_transcript(path: str) -> list[dict]:
    """Parse a JSONL transcript; unparseable lines become ``{"type": "_unparseable"}``."""
    entries: list[dict] = []
    # JSONL is newline-delimited; str.splitlines() would also break on other Unicode boundaries
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


def _find_urls(text: str) -> list[str]:
    """http/https URLs with trailing punctuation stripped, deduplicated in first-seen order."""
    deduped = dict.fromkeys(
        match.group().rstrip(_TRAILING_PUNCTUATION) for match in _URL_PATTERN.finditer(text)
    )
    return list(deduped)


def _check_url(url: str) -> dict:
    """Probe one URL; restricted-but-present codes (see ``_REACHABLE_HTTP_ERRORS``) count as ok."""
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
            return {"url": url, "ok": True, "status": response.status}
    except urllib.error.HTTPError as exc:
        return {"url": url, "ok": exc.code in _REACHABLE_HTTP_ERRORS, "status": exc.code}
    except Exception as exc:
        return {"url": url, "ok": False, "error": f"{type(exc).__name__}: {exc}"}


def _capture_path() -> Path | None:
    """The JSONL capture file, or None when CLAUDE_PLUGIN_DATA is unset (not a plugin run)."""
    # CLAUDE_PLUGIN_DATA is the only dir Claude Code persists across plugin updates; without
    # it there is nowhere safe to write, so we skip capturing rather than guess a location.
    base = os.environ.get("CLAUDE_PLUGIN_DATA")
    return Path(base) / "anti-cheat-capture.jsonl" if base else None


def _append(record: dict) -> None:
    """Append one record to the capture file; a no-op when there is no capture path."""
    path = _capture_path()
    if path is None:
        return
    line = json.dumps(record, ensure_ascii=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    # transcripts occasionally carry lone surrogates that strict UTF-8 cannot encode
    with path.open("ab") as f:
        f.write(line.encode("utf-8", errors="replace"))


def _block_decision(verify: dict) -> dict | None:
    """A Stop ``block`` decision naming the turn's unreachable URLs, or None when all resolve."""
    unreachable = [entry["url"] for entry in verify.get("urls", []) if not entry["ok"]]
    if not unreachable:
        return None
    listed = "\n".join(f"  - {url}" for url in unreachable)
    reason = (
        f"These URLs in your last message could not be reached:\n{listed}\n"
        "They look like fabricated citations. Re-answer the user without them: cite "
        "only URLs you are sure are real, or say you could not find a source."
    )
    return {"decision": "block", "reason": reason}


def main() -> None:
    """Stop hook entry point: record the turn's URL check; block a re-answer on unreachable cites."""
    sys.stdout.reconfigure(encoding="utf-8")
    raw = sys.stdin.read()
    record: dict = {"captured_at": datetime.now().isoformat()}
    try:
        hook_input = json.loads(raw)
        record["hook_input"] = {key: hook_input.get(key) for key in _HOOK_INPUT_FIELDS}
        record["verify"] = _verify(hook_input["transcript_path"])
    except Exception as exc:
        record["error"] = f"{type(exc).__name__}: {exc}"
        record["raw_stdin"] = raw[:_RAW_STDIN_LIMIT]
    try:
        _append(record)
    except Exception:  # a hook must never disrupt Claude, even when its own logging fails
        pass
    decision = _block_decision(record.get("verify", {}))
    if decision is not None:
        print(json.dumps(decision, ensure_ascii=False))


if __name__ == "__main__":
    main()
