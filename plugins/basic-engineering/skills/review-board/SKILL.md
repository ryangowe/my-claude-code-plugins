---
name: review-board
description: Review the current change by fanning out to every available *-reviewer subagent in parallel, then ranking and consolidating their findings.
---

# Review board

对当前改动做一次审查。本 skill 是入口编排: 并行调用所有可用的 `*-reviewer` subagent,再汇总它们的结果。

## Step 1 - 确定 reviewer

所有以 `-reviewer` 结尾的 agent 都是潜在的 reviewer。

不在上述列表中的 reviewer（用户仓库自定义的）以 `model: sonnet` 调用。

模型分配（调用 Agent 时必须通过 `model` 参数显式传入，frontmatter 的 `model:` 字段因 [claude-code#43869](https://github.com/anthropics/claude-code/issues/43869) 不生效）:

| reviewer           | model 参数 |
| ------------------ | ---------- |
| craft-reviewer     | opus       |
| structure-reviewer | opus       |
| reuse-reviewer     | opus       |
| change-reviewer    | sonnet     |
| sanity-reviewer    | haiku      |
| comment-reviewer   | haiku      |

## Step 2 - 确定 review 范围

review 范围可能是:

1. 整个 repo 或者某个目录下的全部代码（非改动）
2. 未提交的全部改动
3. commit / commit range 的全部改动

不要尝试过度限制 review 范围。

## Step 3 - 发起 review

并行调用所有 reviewer。

**不要省略 `model` 参数。** agent frontmatter 里的 `model:` 字段不生效（[#43869](https://github.com/anthropics/claude-code/issues/43869)），subagent 会静默继承父会话模型。你必须在每个 Agent 调用里显式传 `model` 参数，值从上面的模型分配表查。不在表中的自定义 reviewer 传 `model: sonnet`。

## Step 4 - Filter, dedupe, and rank

1. 去重:多个 reviewer 报了同一个问题,合并为一条。
2. 先按发现该问题的 reviewer 数量分组(多人 → 单人),再在组内按类别排序:常识问题 → bug → 错误做法 → 设计问题 → 文档不符 → 需确认 → 惯例。

## Output format

沿用 how-to-review 的单条格式,补充 reviewer 命中数和来源。先按命中数分组,组内按类别排序:

```text
## 审查汇总

共 N 条 · 来自 M 个 reviewer

### 多个 reviewer 发现 (K 条)

1. <简述> (<类别>) — `file:line` [N/M reviewer: craft, structure]
   建议:<...>

### 单个 reviewer 发现 (K 条)

2. <简述> (<类别>) — `file:line` [1/M reviewer: change]
   建议:<...>
```

某个分组没有条目时省略。输出简短,不用 emoji。
