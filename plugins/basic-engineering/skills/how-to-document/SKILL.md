---
name: how-to-document
description: Load when writing or updating documentation files (README, guides, specs, changelogs).
---

# How to write documentation

写代码注释和 docstring 请 Load how-to-comment。本 skill 管的是独立的文档文件。

如果有更具体的文档类型 skill（如 create-issue、create-spec），以该 skill 的规范为准；本 skill 仅提供通用的写作原则和兜底骨架。

各类文档的骨架示例见 reference 目录：

- [reference/readme.md](reference/readme.md) — README 骨架（React、Node.js 风格）
- [reference/guide.md](reference/guide.md) — 教程 / 指南骨架（Django / FastAPI 风格）
- [reference/design-doc.md](reference/design-doc.md) — 设计文档 / RFC 骨架（React RFC、Google Design Doc 风格）
- [reference/changelog.md](reference/changelog.md) — Changelog 骨架（Keep a Changelog 格式）

## Snapshotting

文档描述的是一个状态，不是两个版本之间的差异。「最近我们把 X 改成了 Y」这类句子属于 changelog 条目或 PR 描述，不属于正文。唯一的例外是 changelog 本身——它的职责就是记录版本间的差异。

## Audience

写之前回答一个问题：谁会读它、在什么情景下读。答案决定了结构和详略。

读者不是来读散文的。他们带着一个问题来，拿到答案就走。你的任务是让他们尽快找到那个答案。开头一段说清目的和前置条件，让读者能在 10 秒内判断这份文档是不是他要的那份。

不同读者场景对应不同的文档类型——别试图在一份文档里服务两种人。想塞两种读者就拆成两份。

## Structure

用标题分段而非长段落。标题是读者的导航，段落是到达目的地之后才读的东西。

结论和要点放前面，支撑材料放后面。如果读者只看第一段就走，他应该带走最重要的信息。

## Maintenance

文档腐烂的速度比代码快，因为没有编译器帮你检查。减缓腐烂：

- 不要写具体版本号、行号、文件路径，除非你能保证有人会更新它们。引用符号名和目录名比引用行号安全。
- 可执行的文档（Makefile target、shell snippet）比纯文字描述更不容易过时，因为它跑不通的时候会有人修。
- 删掉比修正更好——已经过时的段落，与其花力气改对，不如确认它是否还有存在价值。
