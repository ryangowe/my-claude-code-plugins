---
name: how-to-structure-python-modules
description: Project-specific rules for organizing code inside a Python file — symbol ordering, class layout, constant placement. Load before creating or editing any .py file.
---

# How to structure Python modules

模块和类内部按固定顺序排列,public 在前、private 在后。完整骨架见 [reference/skeleton.py](reference/skeleton.py)。

## Order a module public-first, private-last

模块内符号自上而下:

- stdlib imports
- third-party imports
- package 内绝对引用
- 同 sub package 内相对引用
- public constants
- `_private` constants
  注意， private constants 通常不会和 public constants 同时出现。
  public constants 通常代表 module 是契约生产者，最好独立为单独模块
- public classes
- public functions
- `_private` classes
- `_private` functions
- `main` 函数(若有)

读者从上往下读,先碰到的就是这个模块对外的 API 面,private 细节按需要才往下翻。

## Order a class from constructor to private methods

类内符号自上而下:

- class attributes
- `__init__`
- public static / class methods
- dunder methods
- public methods
- private methods
  注意通常不应该由 private static / class method

## Define private symbols as late as possible

语法允许的情况下,总是把 private symbol 定义在尽可能靠后的位置（除了 constants）

减少细节实现对读者注意力的干扰。

## Quote only the undefined name in a forward reference

private 类定义在 public 函数之后;public 签名里引用还没定义的 private 类时,用字符串标注。引号范围最小化——**只**包裹未定义的那个名字,不要把整个类型表达式放进引号。

### 反例:整个表达式进引号

```python
def build_pipeline(steps: "list[_Step]") -> "_Pipeline": ...
```

### 正例:只引未定义的名字

```python
def build_pipeline(steps: list["_Step"]) -> "_Pipeline": ...
```

## Place each constant in the narrowest scope that uses it

常量放在用得到它的最窄作用域:

- 只在一个函数里用 → 函数体内
- 只被一个类用 → 类里
- 多处共用 → 模块级

作用域越窄,读者要理解这个常量时要扫的范围就越小。

## Don't name a constant just to avoid a magic number

如果目标结构的字段已经表达语义(`cfg.model.lr`),直接内联字面值,不要为了"避免魔法数字"强行抽一个常量名。

强行命名会给读者多一个要追的间接层,而字段路径本身已经说清了这个值是什么。

## Keep try blocks minimal

`try` 块**只**放"需要 `finally` / `except` 保护的操作"。配置、类型设置、前置变量放到 `try` 之前。

`try` 块越窄,`except` 捕获的范围就越精确,不会顺手吞掉前置代码里无关的异常。
