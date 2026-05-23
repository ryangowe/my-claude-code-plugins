"""Tests for require_preamble."""

import json
import sys
from io import StringIO

import pytest
import require_preamble


@pytest.fixture
def capture_path(tmp_path, monkeypatch):
    """Point the capture file into a temp dir via CLAUDE_PLUGIN_DATA, the var the hook reads."""
    monkeypatch.setenv("CLAUDE_PLUGIN_DATA", str(tmp_path))
    return tmp_path / "anti-cheat-preamble.jsonl"


def _write_transcript(path, entries: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(e) for e in entries), encoding="utf-8")


# -- _current_turn -------------------------------------------------------------


def test_current_turn_starts_after_the_last_string_user_prompt():
    entries = [
        {"type": "user", "message": {"content": "old prompt"}},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "old"}]}},
        {"type": "user", "message": {"content": "new prompt"}},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "new"}]}},
    ]
    turn = require_preamble._current_turn(entries)
    assert turn == [
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "new"}]}}
    ]


def test_current_turn_treats_tool_result_as_inside_the_turn():
    # a tool_result is type "user" but its content is a list, so it is not a turn boundary
    entries = [
        {"type": "user", "message": {"content": "prompt"}},
        {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Read"}]}},
        {"type": "user", "message": {"content": [{"type": "tool_result", "content": "x"}]}},
        {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Edit"}]}},
    ]
    assert len(require_preamble._current_turn(entries)) == 3


def test_current_turn_without_any_user_prompt_uses_every_entry():
    entries = [
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "hi"}]}}
    ]
    assert require_preamble._current_turn(entries) == entries


# -- _turn_has_text ------------------------------------------------------------


def test_turn_has_text_true_for_non_empty_text_block():
    turn = [
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "Editing foo.py"}]}}
    ]
    assert require_preamble._turn_has_text(turn) is True


def test_turn_has_text_false_when_only_tool_use_blocks():
    turn = [
        {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Edit"}]}}
    ]
    assert require_preamble._turn_has_text(turn) is False


def test_turn_has_text_false_for_only_whitespace_text():
    turn = [
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "   \n  "}]}}
    ]
    assert require_preamble._turn_has_text(turn) is False


def test_turn_has_text_ignores_thinking_blocks():
    # thinking blocks are not shown to the user; they do not count as declaring intent
    turn = [
        {"type": "assistant", "message": {"content": [{"type": "thinking", "thinking": "plan"}]}}
    ]
    assert require_preamble._turn_has_text(turn) is False


def test_turn_has_text_true_when_text_precedes_tool_use_in_same_entry():
    turn = [
        {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "Let me edit foo.py"},
                    {"type": "tool_use", "name": "Edit"},
                ]
            },
        }
    ]
    assert require_preamble._turn_has_text(turn) is True


# -- _deny ---------------------------------------------------------------------


def test_deny_returns_none_when_tool_is_not_gated():
    assert require_preamble._deny("Read", {"has_text": False}) is None


def test_deny_returns_none_when_turn_has_text():
    assert require_preamble._deny("Edit", {"has_text": True}) is None


def test_deny_payload_is_a_pretooluse_deny_for_gated_tool_without_text():
    payload = require_preamble._deny("Edit", {"has_text": False})
    assert payload is not None
    assert payload["hookSpecificOutput"]["hookEventName"] == "PreToolUse"
    assert payload["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert "Edit" in payload["hookSpecificOutput"]["permissionDecisionReason"]


@pytest.mark.parametrize("tool", ["Edit", "Write", "Bash"])
def test_deny_applies_to_each_gated_tool(tool):
    payload = require_preamble._deny(tool, {"has_text": False})
    assert payload is not None
    assert payload["hookSpecificOutput"]["permissionDecision"] == "deny"


# -- _capture / _append --------------------------------------------------------


def test_capture_path_uses_the_plugin_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("CLAUDE_PLUGIN_DATA", str(tmp_path))
    assert require_preamble._capture_path() == tmp_path / "anti-cheat-preamble.jsonl"


def test_capture_path_is_none_when_the_plugin_data_var_is_unset(monkeypatch):
    monkeypatch.delenv("CLAUDE_PLUGIN_DATA", raising=False)
    assert require_preamble._capture_path() is None


def test_append_is_a_no_op_when_the_plugin_data_var_is_unset(monkeypatch):
    monkeypatch.delenv("CLAUDE_PLUGIN_DATA", raising=False)
    require_preamble._append({"a": 1})  # nowhere to write -- must return quietly, not raise


def test_append_writes_one_json_line_per_record(capture_path):
    require_preamble._append({"a": 1})
    require_preamble._append({"b": 2})
    lines = capture_path.read_text(encoding="utf-8").splitlines()
    assert [json.loads(line) for line in lines] == [{"a": 1}, {"b": 2}]


# -- check (integration) ------------------------------------------------------


def test_check_reports_text_for_a_turn_with_an_announcement(tmp_path):
    path = tmp_path / "t.jsonl"
    _write_transcript(
        path,
        [
            {"type": "user", "message": {"content": "edit foo"}},
            {
                "type": "assistant",
                "message": {"content": [{"type": "text", "text": "Editing foo.py"}]},
            },
        ],
    )
    assert require_preamble.check(str(path)) == {"has_text": True}


def test_check_reports_no_text_for_a_silent_tool_first_turn(tmp_path):
    path = tmp_path / "t.jsonl"
    _write_transcript(
        path,
        [
            {"type": "user", "message": {"content": "edit foo"}},
            {
                "type": "assistant",
                "message": {"content": [{"type": "tool_use", "name": "Edit"}]},
            },
        ],
    )
    assert require_preamble.check(str(path)) == {"has_text": False}


# -- main ---------------------------------------------------------------------


def test_main_denies_a_gated_tool_when_the_turn_has_no_text(capture_path, tmp_path, monkeypatch, capsys):
    transcript = tmp_path / "t.jsonl"
    _write_transcript(
        transcript,
        [
            {"type": "user", "message": {"content": "do it"}},
        ],
    )
    hook_input = {
        "hook_event_name": "PreToolUse",
        "tool_name": "Edit",
        "transcript_path": str(transcript),
    }
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    require_preamble.main()

    payload = json.loads(capsys.readouterr().out)
    assert payload["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert "Edit" in payload["hookSpecificOutput"]["permissionDecisionReason"]


def test_main_allows_a_gated_tool_after_an_announcement(capture_path, tmp_path, monkeypatch, capsys):
    transcript = tmp_path / "t.jsonl"
    _write_transcript(
        transcript,
        [
            {"type": "user", "message": {"content": "do it"}},
            {
                "type": "assistant",
                "message": {"content": [{"type": "text", "text": "Editing foo.py now."}]},
            },
        ],
    )
    hook_input = {
        "hook_event_name": "PreToolUse",
        "tool_name": "Edit",
        "transcript_path": str(transcript),
    }
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    require_preamble.main()

    assert capsys.readouterr().out == ""


def test_main_ignores_ungated_tools(capture_path, tmp_path, monkeypatch, capsys):
    transcript = tmp_path / "t.jsonl"
    _write_transcript(transcript, [{"type": "user", "message": {"content": "look"}}])
    hook_input = {
        "hook_event_name": "PreToolUse",
        "tool_name": "Read",
        "transcript_path": str(transcript),
    }
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    require_preamble.main()

    assert capsys.readouterr().out == ""


def test_main_records_the_error_and_never_raises_on_bad_input(capture_path, monkeypatch):
    monkeypatch.setattr(sys, "stdin", StringIO("not valid json"))

    require_preamble.main()

    record = json.loads(capture_path.read_text(encoding="utf-8").splitlines()[-1])
    assert "error" in record


def test_main_appends_a_check_record(capture_path, tmp_path, monkeypatch):
    transcript = tmp_path / "t.jsonl"
    _write_transcript(
        transcript,
        [
            {"type": "user", "message": {"content": "edit foo"}},
            {
                "type": "assistant",
                "message": {"content": [{"type": "text", "text": "Editing foo.py"}]},
            },
        ],
    )
    hook_input = {
        "hook_event_name": "PreToolUse",
        "tool_name": "Edit",
        "transcript_path": str(transcript),
    }
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    require_preamble.main()

    record = json.loads(capture_path.read_text(encoding="utf-8").splitlines()[-1])
    assert record["hook_input"]["tool_name"] == "Edit"
    assert record["check"] == {"has_text": True}
    assert "error" not in record
