"""Tests for detect_hedging."""

import json
import sys
from io import StringIO

import pytest
import detect_hedging


@pytest.fixture
def capture_path(tmp_path, monkeypatch):
    """Point the capture file into a temp dir via CLAUDE_PLUGIN_DATA."""
    monkeypatch.setenv("CLAUDE_PLUGIN_DATA", str(tmp_path))
    return tmp_path / "anti-cheat-hedging.jsonl"


@pytest.fixture
def make_transcript(tmp_path):
    """Factory: write a transcript JSONL file with one assistant turn."""

    def make(assistant_text: str):
        path = tmp_path / "t.jsonl"
        entries = [
            {"type": "user", "message": {"content": "tell me about X"}},
            {
                "type": "assistant",
                "message": {"content": [{"type": "text", "text": assistant_text}]},
            },
        ]
        path.write_text("\n".join(json.dumps(e) for e in entries), encoding="utf-8")
        return path

    return make


# -- _split_clauses -----------------------------------------------------------


def test_split_clauses_on_ascii_comma():
    clauses = detect_hedging._split_clauses("it works, but slowly")
    assert clauses == ["it works", "but slowly"]


def test_split_clauses_on_fullwidth_comma():
    clauses = detect_hedging._split_clauses("可以，但是不太好")
    assert len(clauses) == 2
    assert clauses[0].strip() == "可以"


def test_split_clauses_on_semicolons():
    clauses = detect_hedging._split_clauses("one; two；three")
    assert len(clauses) == 3


def test_split_clauses_drops_empty_clauses():
    clauses = detect_hedging._split_clauses(",, hello ,")
    assert clauses == ["hello"]


def test_split_clauses_no_separator():
    clauses = detect_hedging._split_clauses("no separators here")
    assert clauses == ["no separators here"]


# -- _is_hedging ---------------------------------------------------------------


def test_is_hedging_detects_but():
    assert detect_hedging._is_hedging("but it may vary") is True


def test_is_hedging_detects_however():
    assert detect_hedging._is_hedging("however this is uncertain") is True


def test_is_hedging_detects_chinese_conjunction():
    assert detect_hedging._is_hedging("但是不确定") is True


def test_is_hedging_ignores_long_clauses():
    long_clause = "this is a perfectly reasonable clause but it has many words in it overall"
    assert detect_hedging._is_hedging(long_clause) is False


def test_is_hedging_clean_clause():
    assert detect_hedging._is_hedging("the API returns JSON") is False


def test_is_hedging_case_insensitive():
    assert detect_hedging._is_hedging("But maybe not") is True


def test_is_hedging_detects_yet():
    assert detect_hedging._is_hedging("yet unclear") is True


def test_is_hedging_detects_although():
    assert detect_hedging._is_hedging("although uncertain") is True


# -- detect (integration) -----------------------------------------------------


def test_detect_flags_hedging_clause(make_transcript):
    path = make_transcript("it supports JSON, but I'm not sure about XML")
    result = detect_hedging.detect(str(path))
    assert len(result["flagged_clauses"]) == 1
    assert "but" in result["flagged_clauses"][0].lower()


def test_detect_clean_text(make_transcript):
    path = make_transcript("the function returns a list of integers")
    result = detect_hedging.detect(str(path))
    assert result["flagged_clauses"] == []


def test_detect_multiple_hedges(make_transcript):
    path = make_transcript("A works, but B might not, however C is fine")
    result = detect_hedging.detect(str(path))
    assert len(result["flagged_clauses"]) == 2


def test_detect_chinese_hedging(make_transcript):
    path = make_transcript("这个方法可以，但是效果不太好")
    result = detect_hedging.detect(str(path))
    assert len(result["flagged_clauses"]) >= 1


# -- _block_decision -----------------------------------------------------------


def test_block_decision_flags_hedging():
    result = {"flagged_clauses": ["but I'm not sure"]}
    decision = detect_hedging._block_decision(result)
    assert decision is not None
    assert decision["decision"] == "block"
    assert "but I'm not sure" in decision["reason"]


def test_block_decision_none_when_clean():
    result = {"flagged_clauses": []}
    assert detect_hedging._block_decision(result) is None


# -- _capture ------------------------------------------------------------------


def test_capture_path_uses_plugin_data(monkeypatch, tmp_path):
    monkeypatch.setenv("CLAUDE_PLUGIN_DATA", str(tmp_path))
    assert detect_hedging._capture_path() == tmp_path / "anti-cheat-hedging.jsonl"


def test_capture_path_is_none_without_env(monkeypatch):
    monkeypatch.delenv("CLAUDE_PLUGIN_DATA", raising=False)
    assert detect_hedging._capture_path() is None


def test_append_writes_record(capture_path):
    detect_hedging._append({"test": True})
    record = json.loads(capture_path.read_text(encoding="utf-8").strip())
    assert record == {"test": True}


# -- main ----------------------------------------------------------------------


def test_main_appends_record_and_does_not_block_on_clean_text(
    capture_path, make_transcript, monkeypatch
):
    path = make_transcript("this is a clean answer")
    hook_input = {"hook_event_name": "Stop", "transcript_path": str(path)}
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    detect_hedging.main()

    record = json.loads(capture_path.read_text(encoding="utf-8").splitlines()[-1])
    assert record["detect"]["flagged_clauses"] == []
    assert "error" not in record


def test_main_blocks_on_hedging_text(
    capture_path, make_transcript, monkeypatch, capsys
):
    path = make_transcript("it works, but I'm not sure")
    hook_input = {"hook_event_name": "Stop", "transcript_path": str(path)}
    monkeypatch.setattr(sys, "stdin", StringIO(json.dumps(hook_input)))

    detect_hedging.main()

    decision = json.loads(capsys.readouterr().out)
    assert decision["decision"] == "block"


def test_main_handles_bad_input_gracefully(capture_path, monkeypatch):
    monkeypatch.setattr(sys, "stdin", StringIO("not json"))

    detect_hedging.main()

    record = json.loads(capture_path.read_text(encoding="utf-8").splitlines()[-1])
    assert "error" in record
