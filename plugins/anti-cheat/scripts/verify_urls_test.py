"""Tests for verify_urls."""

import json
import sys
import urllib.error
from email.message import Message
from io import StringIO

import pytest
import verify_urls


class FakeResponse:
    """Stand-in for an HTTP response, usable as a context manager."""

    def __init__(self, status: int):
        self.status = status

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False


@pytest.fixture(autouse=True)
def block_network(monkeypatch):
    """Replace urlopen everywhere so no test can reach the real network."""

    def forbidden(*args, **kwargs):
        raise RuntimeError("blocked: test attempted real network access")

    monkeypatch.setattr(verify_urls.urllib.request, "urlopen", forbidden)


@pytest.fixture
def capture_path(tmp_path, monkeypatch):
    """Point the capture file into a temp dir via CLAUDE_PLUGIN_DATA, the var the hook reads."""
    monkeypatch.setenv("CLAUDE_PLUGIN_DATA", str(tmp_path))
    return tmp_path / "anti-cheat-capture.jsonl"


@pytest.fixture
def transcript_citing_a_dead_url(tmp_path):
    """A transcript whose only assistant turn cites a URL; block_network makes that URL unreachable."""
    path = tmp_path / "t.jsonl"
    entries = [
        {"type": "user", "message": {"content": "got a source?"}},
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "see https://dead.example/x"}]},
        },
    ]
    path.write_text("\n".join(json.dumps(e) for e in entries), encoding="utf-8")
    return path


def test_load_transcript_parses_lines_and_skips_blanks(tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text('{"type": "a"}\n\n{"type": "b"}\n', encoding="utf-8")
    assert verify_urls._load_transcript(str(path)) == [{"type": "a"}, {"type": "b"}]


def test_load_transcript_marks_unparseable_lines(tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text('{"type": "a"}\nnot json\n', encoding="utf-8")
    assert verify_urls._load_transcript(str(path)) == [
        {"type": "a"},
        {"type": "_unparseable"},
    ]


def test_load_transcript_keeps_lines_holding_a_unicode_line_separator(tmp_path):
    # U+2028 inside a value: str.splitlines() would wrongly split here, str.split("\n") must not
    entry = {"type": "assistant", "text": "a" + chr(0x2028) + "b"}
    path = tmp_path / "t.jsonl"
    path.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    assert verify_urls._load_transcript(str(path)) == [entry]


def test_last_turn_text_collects_assistant_text_after_the_last_user_prompt():
    entries = [
        {"type": "user", "message": {"content": "old prompt"}},
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "old answer"}]},
        },
        {"type": "user", "message": {"content": "new prompt"}},
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "new answer"}]},
        },
    ]
    assert verify_urls._last_turn_text(entries) == "new answer"


def test_last_turn_text_treats_a_tool_result_as_inside_the_turn():
    # a tool_result is type "user" but its content is a list, so it is not a turn boundary
    entries = [
        {"type": "user", "message": {"content": "real prompt"}},
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "first"}]},
        },
        {
            "type": "user",
            "message": {"content": [{"type": "tool_result", "content": "x"}]},
        },
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "second"}]},
        },
    ]
    assert verify_urls._last_turn_text(entries) == "first\n\nsecond"


def test_last_turn_text_keeps_only_text_blocks():
    entries = [
        {"type": "user", "message": {"content": "prompt"}},
        {
            "type": "assistant",
            "message": {"content": [{"type": "thinking", "thinking": "hmm"}]},
        },
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "part one"}]},
        },
        {
            "type": "assistant",
            "message": {"content": [{"type": "tool_use", "name": "X"}]},
        },
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "part two"}]},
        },
    ]
    assert verify_urls._last_turn_text(entries) == "part one\n\npart two"


def test_last_turn_text_without_a_user_prompt_uses_every_entry():
    entries = [
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "answer"}]},
        }
    ]
    assert verify_urls._last_turn_text(entries) == "answer"


def test_find_urls_strips_trailing_ascii_punctuation():
    assert verify_urls._find_urls("see https://example.com/path.") == [
        "https://example.com/path"
    ]


def test_find_urls_stops_at_non_ascii_without_a_separating_space():
    # the fullwidth comma here has no space before it -- the URL match must stop, not swallow it
    text = "link https://example.com/y，more text"
    assert verify_urls._find_urls(text) == ["https://example.com/y"]


def test_find_urls_bounds_on_markdown_and_inline_code_delimiters():
    text = "[doc](https://example.org/) and `https://example.com/p` done"
    assert verify_urls._find_urls(text) == [
        "https://example.org/",
        "https://example.com/p",
    ]


def test_find_urls_deduplicates_in_first_seen_order():
    text = "https://example.com/two https://example.com/one https://example.com/two"
    assert verify_urls._find_urls(text) == [
        "https://example.com/two",
        "https://example.com/one",
    ]


def test_find_urls_returns_empty_when_there_are_none():
    assert verify_urls._find_urls("plain text, no links") == []


def test_check_url_is_ok_on_a_2xx_status(monkeypatch):
    monkeypatch.setattr(
        verify_urls.urllib.request, "urlopen", lambda *a, **k: FakeResponse(200)
    )
    assert verify_urls._check_url("https://example.com") == {
        "url": "https://example.com",
        "ok": True,
        "status": 200,
    }


def test_check_url_is_not_ok_on_a_404(monkeypatch):
    def raise_404(*a, **k):
        raise urllib.error.HTTPError(
            "https://example.com", 404, "Not Found", Message(), None
        )

    monkeypatch.setattr(verify_urls.urllib.request, "urlopen", raise_404)
    assert verify_urls._check_url("https://example.com") == {
        "url": "https://example.com",
        "ok": False,
        "status": 404,
    }


def test_check_url_is_ok_on_a_restricted_but_present_status(monkeypatch):
    def raise_403(*a, **k):
        raise urllib.error.HTTPError(
            "https://example.com", 403, "Forbidden", Message(), None
        )

    monkeypatch.setattr(verify_urls.urllib.request, "urlopen", raise_403)
    assert verify_urls._check_url("https://example.com")["ok"] is True


def test_check_url_is_not_ok_on_a_network_error(monkeypatch):
    def raise_urlerror(*a, **k):
        raise urllib.error.URLError("name resolution failed")

    monkeypatch.setattr(verify_urls.urllib.request, "urlopen", raise_urlerror)
    result = verify_urls._check_url("https://example.com")
    assert result["ok"] is False
    assert "error" in result


def test_capture_path_uses_the_plugin_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("CLAUDE_PLUGIN_DATA", str(tmp_path))
    assert verify_urls._capture_path() == tmp_path / "anti-cheat-capture.jsonl"


def test_capture_path_is_none_when_the_plugin_data_var_is_unset(monkeypatch):
    monkeypatch.delenv("CLAUDE_PLUGIN_DATA", raising=False)
    assert verify_urls._capture_path() is None


def test_append_is_a_no_op_when_the_plugin_data_var_is_unset(monkeypatch):
    monkeypatch.delenv("CLAUDE_PLUGIN_DATA", raising=False)
    verify_urls._append({"a": 1})  # nowhere to write -- must return quietly, not raise


def test_append_writes_one_json_line_per_record(capture_path):
    verify_urls._append({"a": 1})
    verify_urls._append({"b": 2})
    lines = capture_path.read_text(encoding="utf-8").splitlines()
    assert [json.loads(line) for line in lines] == [{"a": 1}, {"b": 2}]


def test_append_tolerates_an_un_encodable_lone_surrogate(capture_path):
    # a lone surrogate has no valid UTF-8 encoding; _append must replace it, not raise
    verify_urls._append({"text": "before" + chr(0xDC86) + "after"})
    assert json.loads(capture_path.read_text(encoding="utf-8")) == {
        "text": "before?after"
    }


def test_block_decision_flags_only_the_unreachable_urls():
    verify = {
        "urls": [
            {"url": "https://reachable.example", "ok": True, "status": 200},
            {"url": "https://dead.example", "ok": False, "status": 404},
        ]
    }
    decision = verify_urls._block_decision(verify)
    assert decision is not None
    assert decision["decision"] == "block"
    assert "https://dead.example" in decision["reason"]
    assert "https://reachable.example" not in decision["reason"]


def test_block_decision_is_none_when_every_url_resolves():
    verify = {"urls": [{"url": "https://reachable.example", "ok": True, "status": 200}]}
    assert verify_urls._block_decision(verify) is None


def test_main_appends_a_verify_record(capture_path, tmp_path, monkeypatch):
    transcript = tmp_path / "t.jsonl"
    entries = [
        {"type": "user", "message": {"content": "do the thing"}},
        {
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "no links here"}]},
        },
    ]
    transcript.write_text("\n".join(json.dumps(e) for e in entries), encoding="utf-8")
    hook_input = {"hook_event_name": "Stop", "transcript_path": str(transcript)}
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    verify_urls.main()

    record = json.loads(capture_path.read_text(encoding="utf-8").splitlines()[-1])
    assert record["hook_input"]["hook_event_name"] == "Stop"
    assert record["verify"]["urls"] == []
    assert "error" not in record


def test_main_records_the_error_and_never_raises_on_bad_input(
    capture_path, monkeypatch
):
    monkeypatch.setattr(sys, "stdin", StringIO("not valid json"))

    verify_urls.main()

    record = json.loads(capture_path.read_text(encoding="utf-8").splitlines()[-1])
    assert "error" in record


def test_main_blocks_the_stop_when_the_turn_cites_an_unreachable_url(
    capture_path, transcript_citing_a_dead_url, monkeypatch, capsys
):
    hook_input = {
        "hook_event_name": "Stop",
        "transcript_path": str(transcript_citing_a_dead_url),
    }
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    verify_urls.main()

    decision = json.loads(capsys.readouterr().out)
    assert decision["decision"] == "block"
    assert "https://dead.example/x" in decision["reason"]


def test_main_blocks_a_retry_too_when_it_still_cites_an_unreachable_url(
    capture_path, transcript_citing_a_dead_url, monkeypatch, capsys
):
    # stop_hook_active marks a retry; the hook blocks anyway -- a cheat stays blocked
    hook_input = {
        "hook_event_name": "Stop",
        "transcript_path": str(transcript_citing_a_dead_url),
        "stop_hook_active": True,
    }
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    verify_urls.main()

    assert json.loads(capsys.readouterr().out)["decision"] == "block"
