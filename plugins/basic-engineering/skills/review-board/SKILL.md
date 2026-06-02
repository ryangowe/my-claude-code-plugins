---
name: review-board
description: Review the current change by fanning out to every available *-reviewer subagent in parallel, then ranking and consolidating their findings.
---

# Review board

对当前改动做一次审查。本 skill 是入口编排: 并行调用所有可用的 `*-reviewer` subagent,再汇总它们的结果。

reviewer 名单不写死。凡名字以 `-reviewer` 结尾、当前可用的 subagent 全部纳入。basic-engineering 自带 `craft-reviewer`、`comment-reviewer`、`change-reviewer`、`structure-reviewer`、`reuse-reviewer`;其它已安装插件加入的 `*-reviewer`(如某语言知识库的 reviewer)同样自动纳入。

## Steps

请严格按以下步骤执行:

1. 确定审查范围:优先用给定的改动范围,否则运行 git diff。没有改动则停止并告知用户。
2. 列出 reviewer:从你可用的 subagent 类型里选出所有以 `-reviewer` 结尾的,并用它们的限定全名 `<插件名>:<agent>`(如 `basic-engineering:craft-reviewer`);裸名 `craft-reviewer` 不会解析。看不到完整列表时,在已安装插件目录 glob `*/agents/*-reviewer.md`,再用该插件 `.claude-plugin/plugin.json` 里的 `name` 拼成 `<name>:<文件名去掉 .md>`。
3. 准备传给每个 reviewer 的上下文:改动涉及的文件,(若已知)写代码时用到的 how-to skill,以及(若已知)本次改动的需求 / 任务意图——接需求的 reviewer 会用到,其余的会忽略。
4. 并行分发:在同一条消息里发起全部 reviewer 的 Task 调用,把范围与上下文传给每一个。在调用里提醒每个 reviewer 先加载 how-to-review skill,拿到共用的流程与报告格式;拓展插件的 reviewer 可能没在自己文件里写这个提醒。
5. 收齐结果后去重、排序,再输出汇总。

## Filter, dedupe, and rank

- 先按置信度过滤:reviewer 只打分、不自己筛,这里丢掉 score < 80 的。
- 去重:同一 `file:line` 的同一问题只留一条。多个 reviewer 都报的,记下全部来源。
- 每个 reviewer 的专长即它声明的侧重领域。
- 按优先级分三层:
  1. 多个 reviewer 共同发现的问题。优先级最高。
  2. 单个 reviewer 发现、且落在其专长领域内的问题。
  3. 其余问题。

## Output format

发现问题时:

```text
## 审查汇总

共 N 条 · 来自 M 个 reviewer

### 多 reviewer 共同发现

1. <简述> — `file:line` (craft + change)
   建议:<...>

### 专长发现

1. <简述> — `file:line` (comment-reviewer)
   建议:<...>

### 其他

1. <简述> — `file:line` (change-reviewer)
   建议:<...>
```

某一层没有条目时省略该小节。全部无问题时:

```text
## 审查汇总

所有 reviewer 均无问题。
```

输出简短,不用 emoji。
