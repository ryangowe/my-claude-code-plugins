---
name: how-to-document
description: Load when writing comments or docstrings.
---

# How to document code

这个 skill 提倡两个原则：快照化（snapshotting）与注意力（attention，即少写注释）。原则与语言无关，示例以 Python 举例。

- docstring / doc-comment 用所在语言的惯用风格（Python 用 Google style）
- docstrings/comments 都用英语书写

## Snapshotting

任何要提交进 git 的内容都应当是某个状态的快照，而不是两个 commit 之间的差异。对文档来说，合法的内容只有三类：

- 仅描述当前状态——不描述从一个 commit 到另一个 commit 的变化。
- 描述一种未来的目标状态。
- 解释代码从 general purpose 的默认做法（而非某个具体 commit）演化到当前状态的思路。

出现「之前 / 改成了 / 不再」这类措辞，往往是把 commit 间的差异写进了快照，应当删掉——这类信息属于 commit message 或 PR 描述。

## Attention (minimize comments)

注释与 docstring 都在抢读者的注意力，所以写得越少、越精准越好。

### Minimize writing docstrings

- 优先将契约代码化而非写 docstrings/comments
- 更多依靠类型签名与命名表达语义
- 不应该假设 docstrings/comments 比代码更容易让人理解。不要用注释重新描述代码做了什么。
- docstrings/comments 更新频率应当低于代码。它们对具体实现的依赖应该低于代码接口。

### Comment only the global context the code can't show

注释只写局部看不出的全局上下文,每条限一行,用英语写。值得写的:

- 单位 / 坐标系:`# meters, +x forward +y left` / `# turns, not radians`
- 数据形状约束:`# [B, K, N, 2]`（在 Python / 张量代码里 Load how-to-annotate-array-shapes）
- 非显而易见的反向 / 不变关系:`encode_x` 与 `decode_x` 互逆
- 函数依赖的一个上游假设(不在签名里)
- 难以代码化的契约约束

注释超过一行,说明该重写的是代码本身,而不是补一段说明把它解释清楚。

### Keep docstrings short by default

docstring 默认就短,按三段写:

1. 第一行 title: 一句话说清做什么,祈使句或第三人称单数
2. optional detail: 2-4 行，写非显然的 WHY / 关键约束 / 行为差异
3. optional Args / Returns / Raises。对于 Args 注意如果要写就要写完整
4. 更新 docstring 时要注意删减。避免长度膨胀

# Examples

以下示例用 Python，但规则适用于任何语言。

## 反例:写进了 commit 间的差异

```python
# previously a list, switched to a set for O(1) lookup
seen: set[str] = set()
```

## 正例:解释相对默认做法的取舍（快照）

```python
# set for O(1) membership; a list would be O(n)
seen: set[str] = set()
```

## 反例:复述实现步骤

```python
def process_order(order: Order) -> Receipt:
    """Process a single order.

    First validate the order, then charge the payment method, then
    reserve inventory, then emit a confirmation event. Returns the receipt.
    """
```

## 正例:一行说清做什么

```python
def process_order(order: Order) -> Receipt:
    """Charge, reserve inventory, and confirm one order."""
```

## 反例:复述参数 + 返回

```python
def merge_configs(base: dict, override: dict) -> dict:
    """Merge two config dicts.

    Takes the base dict and the override dict, copies every key from
    override into the result, and returns the merged dict.
    """
```

## 正例:只留签名看不出的 WHY

```python
def merge_configs(base: dict, override: dict) -> dict:
    """Merge two configs; override wins on key conflicts."""
```

## 反例:复述具体数字

```python
# drifts when _MAX_RETRIES changes
"""Retry up to 3 times before giving up."""
```

## 正例:引用符号

```python
# names the symbol, stays correct
"""Retry up to ``_MAX_RETRIES`` times before giving up."""
```
