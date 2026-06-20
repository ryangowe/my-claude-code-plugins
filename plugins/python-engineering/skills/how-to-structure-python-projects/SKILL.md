---
name: how-to-structure-python-projects
description: Project-specific rules for Python project layout, package hierarchy, imports, and dependency management. Load before creating a Python project, adding or moving modules, or fixing import issues.
---

# How to structure Python projects

## Use uv

用 `uv` 管理项目

- 不要使用任何其他相同定位的工具
- 禁止 uv run pip

## Prefer libraries over reinventing

任何需求优先考虑有流行度的第三方库

- 使用 grep MCP，检索相似需求其他人是如何实现的
- 使用 context7 MCP，确认候选库的实际 API 和文档。不要依赖猜测。
- 或许建议（必须经过讨论）用户略微调整需求以能够使用流行的解决方案

## Put code under a src/ layout & Keep exactly two package layers

- 代码放在 `src/<project_package>/` 下
- `project_package` 下只放 `sub_package`,`sub_package` 下只放 `sub_module`
- 维护两层架构。永远不要有第三层。
- __init__.py 保持空,不做 re-export

### 示例:两层布局

```
src/my_project/
├── orders/              # sub_package
│   ├── __init__.py
│   ├── cart.py          # sub_module
│   └── _pricing.py      # private sub_module
└── billing/             # sub_package
    ├── __init__.py
    └── invoice.py
```

## Mark visibility with the _ prefix

用 `_` 前缀标注符号的可见性,让人和 LLM 从名字直接读出它能不能用、从哪里用:

- 禁止 import _ 开头的 module 内符号
- 禁止跨 sub_package import _ 开头的 python module
- 通过 tach 的 `[[interfaces]]` 进行维护。参考 [reference/tach.toml](reference/tach.toml)

## Keep sub_package dependencies a DAG

sub_package 之间的依赖必须是**有向无环图**:`orders` import `billing`,则 `billing` 不能直接或间接 import `orders`。出现循环时,把共用部分抽成一个新 sub_package,让原来两个都依赖它,而不是互相 import。
用 `tach` 把这个 DAG 变成可执行规则,配置见 [reference/tach.toml](reference/tach.toml)。

## Import relative within a sub_package, absolute across

这条原则用于帮助 LLM 能够一次性写出正确的 import 语句

- 绝对 import 一定不会出现带有 _ 的 module
- 相对 import 可以显式提醒哪些 module 是当前 sub_package 的

### 示例:相对 vs 绝对

```python
# my_project/orders/cart.py
from ._pricing import apply_discount        # same sub_package → relative

# my_project/billing/invoice.py
from my_project.orders.cart import Cart     # different sub_package → absolute
```

## Refactor shared knowledge into its public home

领域类型、常量、约定映射这类公共知识:

- 逻辑上职责匹配的 public sub_module 是最优先归属
- 在项目初期可能存在难以判断归属的问题。可以暂时置于 private sub module
- 跨包需求出现时立即重构: 当出现需要从另一 private sub module 引用领域知识时，代表着需要进行重构

`_` 前缀的作用就是让跨包需求在 import 处立即暴露
