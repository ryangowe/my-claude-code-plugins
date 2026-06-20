---
name: how-to-write-pythonic-code
description: Project-specific Python code style and idiom rules. Load before writing or editing any Python code.
---

# How to write Pythonic code

## Pick the one obvious way

同一件事用 Python 公认的那一种写法:

- 用 `if items:`,不用 `if len(items) > 0:`
- dict key 的缺失/默认处理,用 `dict.get()`、`dict.setdefault()`、`|` merge,而不是手写 branch
- 用 `for...else` 表达"循环是否 break"、用 `try...else` 表达"try 块是否无异常完成",不要自己维护 flag
- 插值用 f-string——例外:`logging` 调用传 `%s` 参数,让 formatter 惰性求值
- 用目标 Python 版本支持的最新语法——例如 3.10+ 的 `X | Y` 联合类型在运行期原生可用,不需要 `from __future__ import annotations`

## Trust the caller

信任类型标注——签名已经排除的类型,不要再加防御性 `if` guard。优先 EAFP 而非 LBYL:直接 `try` / `except` 或让它抛,而不是预先检查。

预检查既冗余,又制造 TOCTOU 窗口——检查和使用之间状态可能已经变了。

### 反例:LBYL 预检查

```python
if key in mapping and mapping[key].ready:
    use(mapping[key])
```

### 正例:EAFP 直接做

```python
try:
    item = mapping[key]
except KeyError:
    return None
```

## Keep code flat, not nested

用 early return / guard clause 把异常路径先处理掉,主逻辑留在最浅一层。函数签名就是上下文边界——边界内不重复校验边界外已保证的东西。

### 反例:嵌套

```python
def handle(req):
    if req.user:
        if req.user.active:
            return do_work(req)
    return None
```

### 正例:guard clause

```python
def handle(req):
    if not req.user:
        return None
    if not req.user.active:
        return None
    return do_work(req)
```

## Use the standard library

不要手写标准库已经提供的东西:

- `collections`:`defaultdict`、`Counter`、`deque`、`ChainMap`
- `itertools`:`groupby`、`chain`、`product`、`pairwise`、`accumulate`
- `functools`:`lru_cache`、`cached_property`、`partial`、`reduce`
- `pathlib`:文件路径用 `Path`,不要字符串拼接
- `dataclasses` / `pydantic`:数据类不要手写 `__init__`
- dunder 协议:`__iter__` / `__enter__` / `__eq__` 等——让对象接入语言机制

## Prefer native library types

不要手写与库等价的逻辑:

- UUID 字段用 `Field(default_factory=uuid4)`,不手写 `str(uuid.uuid4())`
- 写 TOML 用 `tomli_w`,不用模板字符串拼
- 序列化用 pydantic 的 `model_dump(mode="json")`,不手动逐字段转换
