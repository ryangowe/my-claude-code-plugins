# Review-board evals

给 `review-board` skill 做端到端评测的用例。每个 case 给一段 fixture 代码,把 scope 交给 review-board,断言汇总输出里**该出现什么 / 不该出现什么**。不区分哪个 reviewer 命中——只要最终汇总里有就算 PASS。

## Layout

```
evals/
├── cases.json                # 全部 case(见下方 schema)
└── fixtures/<case-id>/       # 每个 case 的输入代码,自洽、不含「这是错的」之类提示
```

fixture 是「刚写好的改动」的快照,**不能泄露答案**:不要在 fixture 注释里写它哪里有问题,否则 reviewer 是照抄而非自己发现,评测就失真了。来历和期望只写在 `cases.json`。

## cases.json schema

顶层:`panel` 标明插件;`skill` 标明被测 skill;`cases` 是用例数组。每个 case:

- `id` — 用例主键,**必须与 `fixtures/<id>/` 目录名一致**。
- `fixture` — 输入代码目录,相对本文件。
- `scope` — 交给 review-board 的审查范围,只说「审哪些文件」。
- `intent` — 可选。代码的**领域意图**,供接需求的 reviewer 判断;只写代码要达成什么,**不写该用哪个 API / 怎么简化**。当一条 case 要考的就是「reviewer 能不能只凭用法判断」(如接口该不该存在),**就不给 intent**——隐藏意图,逼它从代码自己推。
- `should_flag` — 这个 fixture 该不该被命中。
- `expected_findings` — 期望命中的点:`category`、`claim`(语义断言)、`must_reference`(应点到的符号 / 文件)。
- `forbidden_findings` — 期望 review-board **不**说的话:误报,或把问题判成「没问题」。汇总里出现任一条即判 FAIL。
- `expected_min_confidence` — 命中那条的置信度下限(对齐 how-to-review 的 0–100 rubric)。
- `grading` — PASS / FAIL 判定口径。
- `origin` — 来历(真实 session、行号),标明这是重建的真实回归。`expected_reviewer` 记录最可能命中的 reviewer(仅供调试,不影响判分)。

**只有 `scope`(及存在时的 `intent`)会进 review-board 的 prompt。** `expected_findings` / `forbidden_findings` / `grading` / `origin` 以及本 README 都是判分方(人 / grader)专用,绝不能透给被测 skill,否则评测失真。

## Running a case

1. **隔离 fixture**:把 `fixtures/<id>/` 里的代码复制到 evals 目录之外的临时目录(如 `/tmp/<id>/`)。
2. **运行 review-board**:调用 review-board skill,把 `scope`(以及 `intent`,如果有)作为输入,把临时目录作为待审的改动。review-board 会自行分发给所有可用 reviewer 并汇总。任务里写明:本次评测只允许读取这个临时目录,禁止 Read / Grep / Glob 任何该目录以外的路径,避免 reviewer grep 到 `cases.json` 等判分文件。
3. **判分**:按 `grading` 的口径,把 review-board 的汇总输出逐条对照 `expected_findings` 和 `forbidden_findings`,判定 PASS 或 FAIL,并引用报告原文作为依据。不要求特定 reviewer 命中——只要汇总里有即可。语义吻合即可,不必逐字相同。
4. 把结果写入相邻的 `evals-workspace/iteration-N/<case-id>/`。

## Cases

- **duration-seconds-helper** — 不给 intent。fixture 含 `Duration+Seconds.swift` 与 `MockDetector.excerpt.swift`。期望命中与来历见 `cases.json`。
- **slide-easing-claim** — 不给 intent。fixture 含 `Slide.swift` 与 `PlayheadChordView.excerpt.swift`。期望命中与来历见 `cases.json`。
- **tailwind-handwritten-sidebar** — 给 intent。fixture 含 `Sidebar.tsx`、`style.css`、`package.excerpt.json`。期望命中与来历见 `cases.json`。
- **monolith-stylesheet** — 不给 intent。fixture 含 `style.css`(1068 行,6 个组件的样式)和 3 个消费组件 excerpt。期望命中与来历见 `cases.json`。
