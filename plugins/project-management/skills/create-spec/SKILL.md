---
name: create-spec
description: >-
  起草设计 spec 到 docs/spec/ 并用 lotra 评审。触发词包括"写个 spec"、"先出个方案"、
  "设计一下 X"、"plan this feature"、"把设计决策记下来",或用户在讨论一个适合先写
  设计文档再动手的决策。
---

# create-spec

## spec 文档位置与命名

- 将文档放置于 `docs/spec/YYYY-MM-DD-subject/SPEC.md`
- subject 使用小写英文和短横线

可能的附件按照类型放置于 `docs/spec/YYYY-MM-DD-subject/type` 下,
例如

- references: 相关文档、模板等
- diagrams: 设计图、流程图等
- prototypes: 代码原型、demo 等
- scripts: 评估脚本等
- etc.

## 交流

落笔之前首先和用户交流,确认下列要点都已经清楚。

- 要解决的问题
- 现在做的理由
- 范围边界,包括覆盖的部分和明确排除的部分
- 关键决策与取舍
- 技术栈、已有约定、依赖等方面的约束
- 尚未决定的事项

禁止项

- 不要使用 `AskUserQuestion` 来提问
- 不要一次性问多个问题

## 模板选型

按改动的体量从下表中选一个骨架:

| 模板                       | 适用场景                            | 来源                              |
| -------------------------- | ----------------------------------- | --------------------------------- |
| `references/mini-spec.md`  | 增量功能、单组件、改动明确          | Design Docs at Google 精简版      |
| `references/design-doc.md` | 较大子系统、架构、多处权衡          | Design Docs at Google (Malte Ubl) |
| `references/rfc.md`        | 较大或有争议、动手前要先达成共识    | Rust RFC 模板 (rust-lang/rfcs)    |
| `references/adr.md`        | 单个有分量的设计决策加理由,一事一记 | MADR 模板 (adr/madr)              |

模板可能有不同的语言。在编写 spec 时使用中文。

## yaml front matter

在 spec 文档的 yaml front matter 中记录一些元信息, 包括:

```yaml
title: detailed subject title
author: specific claude model and version
date: YYYY-MM-DD
commit: git commit hash or other version identifier
summary: one paragraph TL;DR
```

## 自我审查

每次修改后都需要不同模型的 sub agent 进行对抗性审查，
challenge 任何可能的内容。

用户没有明确限制的内容直接修改。
如果用户观点受到质疑，则重新和用户重新对齐。

## 修订已有 spec

修改不在当前会话创建的 spec 时，
禁止直接修改正文。
通过 callout 语法添加修订。

```
> [!CHANGE] MMM D, YYYY by @claude
> content
```
