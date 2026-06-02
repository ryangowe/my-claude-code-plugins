"""Tests for require_review."""

import json
import sys
from io import StringIO

import pytest
import require_review


@pytest.fixture
def make_transcript(tmp_path):
    def make(entries: list[dict]) -> str:
        path = tmp_path / "t.jsonl"
        path.write_text("\n".join(json.dumps(e) for e in entries), encoding="utf-8")
        return str(path)

    return make


def _edit_block(file_path: str) -> dict:
    return {"type": "tool_use", "name": "Edit", "input": {"file_path": file_path}}


def _write_block(file_path: str) -> dict:
    return {"type": "tool_use", "name": "Write", "input": {"file_path": file_path}}


def _agent_block(subagent_type: str) -> dict:
    return {"type": "tool_use", "name": "Agent", "input": {"subagent_type": subagent_type}}


def _skill_block(skill: str) -> dict:
    return {"type": "tool_use", "name": "Skill", "input": {"skill": skill}}


def _user(text: str) -> dict:
    return {"type": "user", "message": {"content": text}}


def _stop_feedback(text: str = "Stop hook feedback: review needed") -> dict:
    return {"type": "user", "message": {"content": text}}


def _assistant(*blocks) -> dict:
    return {"type": "assistant", "message": {"content": list(blocks)}}


# -- _edited_code_files --------------------------------------------------------


def test_finds_edited_py_files(make_transcript):
    entries = [_user("fix it"), _assistant(_edit_block("/src/main.py"))]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == ["/src/main.py"]


@pytest.mark.parametrize("path", ["/a.ts", "/a.go", "/a.rs", "/a.java", "/a.cpp", "/a.rb"])
def test_finds_other_languages(make_transcript, path):
    entries = [_user("fix it"), _assistant(_edit_block(path))]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == [path]


@pytest.mark.parametrize("path", ["/README.md", "/config.toml", "/data.json", "/notes.txt"])
def test_ignores_non_code_files(make_transcript, path):
    entries = [_user("fix it"), _assistant(_edit_block(path))]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == []


def test_suffix_match_is_case_insensitive(make_transcript):
    entries = [_user("fix it"), _assistant(_edit_block("/src/Main.PY"))]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == ["/src/Main.PY"]


def test_finds_written_code_files(make_transcript):
    entries = [_user("create it"), _assistant(_write_block("/src/new.py"))]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == ["/src/new.py"]


def test_deduplicates_files(make_transcript):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _assistant(_edit_block("/a.py")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == ["/a.py"]


# -- review sufficiency: proactive vs after-the-fact ---------------------------


def test_proactive_single_reviewer_passes(make_transcript):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _assistant(_agent_block("basic-engineering:craft-reviewer")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["reviewed"] is True


@pytest.mark.parametrize("skill", ["basic-engineering:review-board", "review-board"])
def test_review_board_passes(make_transcript, skill):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _assistant(_skill_block(skill)),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["reviewed"] is True


def test_not_reviewed_without_any_review(make_transcript):
    entries = [_user("fix"), _assistant(_edit_block("/a.py"))]
    result = require_review.check(make_transcript(entries))
    assert result["reviewed"] is False


def test_after_block_single_reviewer_does_not_pass(make_transcript):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _stop_feedback(),
        _assistant(_agent_block("basic-engineering:craft-reviewer")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["reviewed"] is False


def test_after_block_review_board_passes(make_transcript):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _stop_feedback(),
        _assistant(_skill_block("basic-engineering:review-board")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["reviewed"] is True


def test_ignores_other_skills(make_transcript):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _assistant(_skill_block("basic-engineering:how-to-document")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["reviewed"] is False


def test_stop_feedback_does_not_reset_turn(make_transcript):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _stop_feedback(),
        _assistant(_skill_block("basic-engineering:review-board")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == ["/a.py"]


# -- _current_turn -------------------------------------------------------------


def test_only_checks_current_turn(make_transcript):
    entries = [
        _user("old prompt"),
        _assistant(_edit_block("/old.py")),
        _user("new prompt"),
        _assistant(_edit_block("/new.py")),
    ]
    result = require_review.check(make_transcript(entries))
    assert result["code_files"] == ["/new.py"]


def test_tool_result_does_not_break_turn(make_transcript):
    entries = [
        _user("do it"),
        _assistant(_edit_block("/a.py")),
        {"type": "user", "message": {"content": [{"type": "tool_result"}]}},
        _assistant(_edit_block("/b.py")),
    ]
    result = require_review.check(make_transcript(entries))
    assert sorted(result["code_files"]) == ["/a.py", "/b.py"]


# -- _block_decision -----------------------------------------------------------


def test_blocks_when_code_edited_without_review():
    result = {"code_files": ["/a.py"], "reviewed": False}
    decision = require_review._block_decision(result)
    assert decision is not None
    assert decision["decision"] == "block"
    assert "/a.py" in decision["reason"]
    assert "review-board" in decision["reason"]


def test_no_block_when_reviewed():
    result = {"code_files": ["/a.py"], "reviewed": True}
    assert require_review._block_decision(result) is None


def test_no_block_when_no_code_files():
    result = {"code_files": [], "reviewed": False}
    assert require_review._block_decision(result) is None


# -- main ----------------------------------------------------------------------


def test_main_blocks_on_unreviewed_code_edit(make_transcript, monkeypatch, capsys):
    entries = [_user("fix"), _assistant(_edit_block("/a.py"))]
    hook_input = {"hook_event_name": "Stop", "transcript_path": make_transcript(entries)}
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    require_review.main()

    decision = json.loads(capsys.readouterr().out)
    assert decision["decision"] == "block"


def test_main_passes_when_reviewed(make_transcript, monkeypatch, capsys):
    entries = [
        _user("fix"),
        _assistant(_edit_block("/a.py")),
        _assistant(_skill_block("basic-engineering:review-board")),
    ]
    hook_input = {"hook_event_name": "Stop", "transcript_path": make_transcript(entries)}
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    require_review.main()

    assert capsys.readouterr().out == ""


def test_main_survives_bad_input(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", StringIO("not json"))

    require_review.main()

    assert capsys.readouterr().out == ""
