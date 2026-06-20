<!--
模板:轻量 spec(mini design doc)。增量功能 / 单组件 / 取舍不大。对应 spec/ 里的 comment-system、cli。
来源:「Design Docs at Google」所称的 1-3 页 mini design doc——下面英文骨架是 design-doc.md 的精简版,无单一权威原版。英文保留,临用翻译。

使用时(由 create-spec 执行):
  1. 落盘到 spec/<今天日期>-<主题>.md
  2. 把下面英文正文翻译成中文,并套用 lotra 约定:Open Questions → `## 待定`,Out of Scope → `## 不在本次范围`
  3. 删掉本注释
-->

# {Title}

## Overview

One or two sentences: what this does and why it's being done now.

## Design

The mechanism, data format, and state transitions. Use tables for enumerations (states, commands, fields) and code blocks for flows and examples. Wherever a decision is made, give the conclusion plus a one-line why.

## Constraints

- Tech stack / existing conventions / dependencies / known gotchas.

## Open Questions

- Anything not yet decided.

## Out of Scope

- What could be mistaken for in-scope but is deliberately excluded, and why.
