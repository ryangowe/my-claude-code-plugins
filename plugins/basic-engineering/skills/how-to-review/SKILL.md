---
name: how-to-review
description: Load when running as a *-reviewer subagent. Holds the shared review procedure, confidence rubric, false-positive list, and report format; your agent file adds only your specialty.
---

# How to review

You run as a single reviewer, not an orchestrator: do each step yourself, and do not spawn other agents.

## Procedure

1. Check whether the change needs a review at all: if there are no changes, the change is automated, or it is very simple and obviously ok, do not proceed.
2. Use the given scope if provided, otherwise run git diff, and form a short summary of the change.
3. Make a todo list, then review along your specialty's lenses, returning a list of issues and the reason each was flagged.
4. Score every issue (rubric below). You score, you do not filter: report every issue with its score and let the orchestrator drop the low ones.

## Confidence rubric

Score each issue on a scale from 0-100:

- 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
- 25: Somewhat confident. This might be a real issue, but may also be a false positive, and you weren't able to verify it. If the issue is stylistic, it is one not explicitly called out in a relevant rule.
- 50: Moderately confident. You verified this is a real issue, but it might be a nitpick or not happen very often in practice; relative to the rest of the change, it's not very important.
- 75: Highly confident. You double-checked and verified it is very likely a real issue that will be hit in practice; the existing approach is insufficient. It is important and will directly impact functionality, or it is directly mentioned in a relevant rule.
- 100: Absolutely certain. You double-checked and confirmed it is definitely a real issue that will happen frequently in practice; the evidence directly confirms it.

If you can't verify an issue, say so rather than asserting it.

## False positives

- Pre-existing issues, and real issues on lines the user did not modify
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues a linter, typechecker, or compiler would catch (imports, type errors, broken tests, formatting, pedantic style). These run separately as CI; do not build or typecheck yourself.
- General code quality (test coverage, general security, documentation), unless a relevant rule explicitly requires it
- Changes in functionality that are likely intentional or directly related to the broader change

## Report

Cite each issue's `file:line`, keep your output brief, and avoid emojis.

When you found issues (example with 2), using the review name and categories from your agent file:

```text
### <review name>

Found 2 issues:

1. <brief description> (<category>) — `path/to/file:line` [score: NN]
   Suggestion: <concrete fix>
2. <brief description> (<category>) — `path/to/file:line` [score: NN]
   Suggestion: <concrete fix>
```

When you found none:

```text
### <review name>

No issues found. Checked <what you checked>.
```

If your specialty calls for it, add an evidence/reason line before the suggestion (cite a doc, rule, or search hit, or say why it's an issue).
