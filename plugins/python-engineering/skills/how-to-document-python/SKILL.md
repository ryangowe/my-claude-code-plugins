---
name: how-to-document-python
description: Load when writing comments or docstrings.
---

# How to document Python

这个 skill 提倡少写注释。并列举几种必要的的情况下应该如何注释。

- docstring 用 Google style
- docstrings/comments 都用英语书写

## Minimize writing docstrings

- 优先将契约代码化而非写 docstrings/comments
- 更多依靠类型签名与命名表达语义
- 不应该假设 docstrings/comments 比代码更容易让人理解。不要用注释重新描述代码做了什么。
- docstrings/comments 更新频率应当低于代码。它们对具体实现的依赖应该低于代码接口。

## Comment only the global context the code can't show

注释只写局部看不出的全局上下文,每条限一行,用英语写。值得写的:

- 单位 / 坐标系:`# meters, +x forward +y left` / `# turns, not radians`
- 数据形状约束:`# [B, K, N, 2]`，Load how-to-annotate-array-shapes
- 非显而易见的反向 / 不变关系:`encode_x` 与 `decode_x` 互逆
- 函数依赖的一个上游假设(不在签名里)
- 难以代码化的契约约束

注释超过一行,说明该重写的是代码本身,而不是补一段说明把它解释清楚。

## Keep docstrings short by default

docstring 默认就短,按三段写:

1. 第一行 title: 一句话说清做什么,祈使句或第三人称单数
2. optional detail: 2-4 行，写非显然的 WHY / 关键约束 / 行为差异
3. optional Args / Returns / Raises。对于 Args 注意如果要写就要写完整
4. 更新 docstring 时要注意删减。避免长度膨胀

# Examples

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
