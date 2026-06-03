# Reviewer evals

给本插件的 `*-reviewer` agent 做评测的用例。每个 case 给一段 fixture 代码,断言某个 reviewer **该报什么 / 不该报什么**,用来量化命中率与误报率。没有内置 runner——按下面的流程用 subagent 手动跑、手动判分。

## Layout

```
evals/
├── cases.json                # 全部 case(见下方 schema)
└── fixtures/<case-id>/       # 每个 case 的输入代码,自洽、不含「这是错的」之类提示
```

fixture 是「刚写好的改动」的快照,**不能泄露答案**:不要在 fixture 注释里写它哪里有问题,否则 reviewer 是照抄而非自己发现,评测就失真了。来历和期望只写在 `cases.json`。

## cases.json schema

顶层:`panel` 标明这套用例属于哪个 reviewer 插件;`cases` 是用例数组。每个 case:

- `id` — 用例主键,**必须与 `fixtures/<id>/` 目录名一致**。
- `target_reviewer` — 被测 reviewer 的限定名(如 `basic-engineering:reuse-reviewer`)。
- `also_expected` — 也合理命中的其他 reviewer(可选)。
- `fixture` — 输入代码目录,相对本文件。
- `scope` — 交给 reviewer 的评审范围,只说「审哪些文件」。
- `intent` — 可选。代码的**领域意图**,供接需求的 reviewer 判断现成 API 是否覆盖;只写代码要达成什么,**不写该用哪个 API / 怎么简化**。当一条 case 要考的就是「reviewer 能不能只凭用法判断」(如接口该不该存在),**就不给 intent**——隐藏意图,逼它从代码自己推。
- `should_flag` — 这个 fixture 该不该被命中。
- `expected_findings` — 期望命中的点:`category`(用 agent 文件里的类别)、`claim`(语义断言)、`must_reference`(应点到的符号 / 文件)。
- `forbidden_findings` — 期望 reviewer **不**说的话:误报,或把问题判成「没问题」。报告里出现任一条即判 FAIL。
- `expected_min_confidence` — 命中那条的置信度下限(对齐 how-to-review 的 0–100 rubric)。
- `grading` — PASS / FAIL 判定口径。
- `origin` — 来历(真实 session、行号),标明这是重建的真实回归。

**只有 `scope`(及存在时的 `intent`)会进 reviewer 的 prompt。** `expected_findings` / `forbidden_findings` / `grading` / `origin` 以及本 README 都是判分方(人 / grader)专用,绝不能透给被测 reviewer,否则评测失真。

## Running a case

1. **隔离 fixture**:先把 `fixtures/<id>/` 里的代码复制到 evals 目录之外的临时目录(如 `/tmp/<id>/`)。
2. **运行 reviewer**:用 Task 启动一个 `subagent_type = <target_reviewer>` 的 subagent,把 `scope`(以及 `intent`,如果有)作为它的任务,把临时目录作为待审的改动,收集它的报告。任务里写明:本次评测只允许读取这个临时目录,禁止 Read / Grep / Glob 任何该目录以外的路径。Task 工具没有目录参数,subagent 默认在仓库 cwd 下搜索,reuse 类 reviewer 的「仓库内已有」检查会 grep 到 `cases.json` 等判分文件;这条限制把答案挡在评测范围之外,reviewer 越界即评测作废。
3. **判分**:按 `grading` 的口径,把报告逐条对照 `expected_findings` 和 `forbidden_findings`,判定 PASS 或 FAIL,并引用报告原文作为依据。语义吻合即可,不必逐字相同。
4. **复现基线(可选)**:让同一份 fixture 再走一遍 `review-board`,看整组 panel 是否重演 `origin` 记录的那次漏报。
5. 把结果写入相邻的 `evals-workspace/iteration-N/<case-id>/`。

## Cases

- **duration-seconds-helper** — target:structure-reviewer。不给 intent。期望命中与来历见 `cases.json`(答案在那里,本节不剧透)。
- **slide-easing-claim** — target:comment-reviewer。不给 intent。fixture 含 `Slide.swift` 与一份 `PlayheadChordView.excerpt.swift` 调用方片段。期望命中与来历见 `cases.json`。
