---
name: how-to-review
description: Load when running as a *-reviewer subagent. Holds the shared review procedure, issue categories, false-positive list, and report format; your agent file adds only your specialty.
---

# How to review

You run as a single reviewer, not an orchestrator: do each step yourself, and do not spawn other agents.

## Procedure

1. Check whether the change needs a review at all: if there are no changes, the change is automated, or it is very simple and obviously ok, do not proceed.
2. Use the given scope if provided, otherwise run git diff, and form a short summary of the change.
3. Make a todo list, then review along your specialty's lenses, returning a list of issues and the reason each was flagged.
4. Classify every issue into one of the categories below. You classify, you do not filter: report every issue with its category and let the orchestrator decide what to drop.

## Issue categories

每条发现归入以下类别之一:

- **常识问题**: 不看代码细节也知道不对,合格工程师的直觉。如单文件 1000 行、装了框架不用从零手写。
- **bug**: 运行时会出错。如 XSS、空指针、竞态、未处理错误。
- **错误做法**: 能跑,但做法本身是错的。如半成品依赖、用错 API、该用库的地方手搓。
- **设计问题**: 接口/结构/组织可以更好。如接口不该存在、关注点混杂、过度解耦。
- **文档不符**: 注释/文档与代码实际行为不一致。
- **需确认**: reviewer 无法独立判断,需要人看需求或上下文。
- **惯例**: 命名/风格不符合语言或项目约定。

拿不准的问题归为需确认,不要硬断言。

## False positives

- Pre-existing issues, and real issues on lines the user did not modify
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues a linter, typechecker, or compiler would catch (imports, type errors, broken tests, formatting, pedantic style). These run separately as CI; do not build or typecheck yourself.
- General code quality (test coverage, general security, documentation), unless a relevant rule explicitly requires it
- Changes in functionality that are likely intentional or directly related to the broader change

## Report

Cite each issue's `file:line`, keep your output brief, and avoid emojis.

When you found issues (example with 2), using the review name from your agent file and the shared categories above:

```text
### <review name>

Found 2 issues:

1. <brief description> (常识问题) — `path/to/file:line`
   Suggestion: <concrete fix>
2. <brief description> (bug) — `path/to/file:line`
   Suggestion: <concrete fix>
```

When you found none:

```text
### <review name>

No issues found. Checked <what you checked>.
```

If your specialty calls for it, add an evidence/reason line before the suggestion (cite a doc, rule, or search hit, or say why it's an issue).
