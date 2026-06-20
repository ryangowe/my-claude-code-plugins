---
name: create-issue
description: >-
  记录 bug、缺陷、功能需求到 docs/issue/。触发词包括"提个 issue"、"记一下这个 bug"、
  "有个问题要记录"、"file an issue"、"这个行为不对",或用户在描述一个需要追踪的问题或需求。
---

# create-issue

## issue 文档位置与命名

- 将文档放置于 `docs/issue/YYYY-MM-DD-subject/ISSUE.md`
- subject 使用小写英文和短横线

可能的附件按照类型放置于 `docs/issue/YYYY-MM-DD-subject/type` 下,
例如

- logs: 相关日志输出
- screenshots: 截图
- scripts: 复现脚本
- etc.

## 交流

落笔之前首先和用户交流,确认下列要点都已经清楚。

- 出了什么问题,或者需要什么功能
- 如何复现,或者预期的行为
- 影响范围和严重程度
- 相关的环境信息

禁止项

- 不要使用 `AskUserQuestion` 来提问
- 不要一次性问多个问题

## 模板选型

按 issue 的类型和复杂度从下表中选一个骨架:

| 模板                                | 适用场景                      | 来源                                      |
| ----------------------------------- | ----------------------------- | ----------------------------------------- |
| `references/bug-report.md`          | 直观的 bug,复现步骤清晰       | facebook/react bug report 模板            |
| `references/detailed-bug-report.md` | 复杂 bug,涉及环境、回归、诊断 | electron/electron bug report 模板         |
| `references/regression.md`          | 之前能用现在不行的回归问题    | rust-lang/rust regression 模板            |
| `references/performance.md`         | 性能退化、卡顿、资源占用过高  | flutter/flutter performance 模板          |
| `references/security.md`            | 安全漏洞,含影响评估和修复建议 | github/securitylab 漏洞报告模板           |
| `references/feature-request.md`     | 功能需求或改进建议            | GitHub 社区标准 + kubernetes/enhancements |
| `references/task.md`                | 日常维护、清理、重构等工作项  | home-assistant/core task 模板             |

模板可能有不同的语言。在编写 issue 时使用中文。

## yaml front matter

在 issue 文档的 yaml front matter 中记录一些元信息,包括:

```yaml
title: detailed issue title
author: specific claude model and version
date: YYYY-MM-DD
commit: short git sha of HEAD when the issue is written
type: bug | regression | performance | security | feature | task
severity: critical | high | medium | low
status: open | resolved
```

`status` 让人一眼判断 issue 是否已解决,不必通读正文。新建时填 `open`;
问题修复后改为 `resolved`,并按「修订已有 issue」用 callout 记下解决它的 commit。

## 自我审查

每次修改后都需要不同模型的 sub agent 进行对抗性审查,
challenge 任何可能的内容。

用户没有明确限制的内容直接修改。
如果用户观点受到质疑,则重新和用户对齐。

## 修订已有 issue

修改不在当前会话创建的 issue 时,
禁止直接修改正文。
通过 callout 语法添加修订。

```
> [!UPDATE] MMM D, YYYY by @claude
> content
```
