---
name: how-to-annotate-array-shapes
description: Load when writing code with NDArrays or tensors.
---

# How to annotate array shapes

## Put shapes in the docstring, not on the parameter line

形参行保持纯粹的类型签名。shape 和语义写进 docstring 的 Args,shape token 用双反引号包起来。

双反引号是 RST inline literal,Sphinx 会渲染成 code——这是 shape 在 docstring 里的标准标记方式。

### 反例:形参行 inline 注释

```python
def interpolate_trajectory(
    waypoints: ArrayLike,    # [N, 3] xyz positions
    timestamps: ArrayLike,   # [N] seconds
    query_times: ArrayLike,  # [M] seconds
) -> NDArray[np.float64]:
    ...
```

### 正例:docstring Args

```python
def interpolate_trajectory(
    waypoints: ArrayLike,
    timestamps: ArrayLike,
    query_times: ArrayLike,
) -> NDArray[np.float64]:
    """Linearly interpolate a 3D trajectory at the given query times.

    Args:
        waypoints: ``[N, 3]`` xyz positions.
        timestamps: ``[N]`` seconds, monotonically increasing.
        query_times: ``[M]`` seconds to evaluate at.

    Returns:
        ``[M, 3]`` interpolated positions.
    """
```

## Annotate in-body shape changes with an inline comment

函数体内 shape 发生非显然变化的那一行——`reshape`、`transpose`、`squeeze` / `unsqueeze`、高级索引、广播——在行尾加一行 `# [B, T, T]` 注释,标出这一行之后的 shape。沿用同一套字母约定;行内注释不是 RST,shape 直接写,不加双反引号。shape 没变、或变化一望即知的行不标。

docstring 标注了函数输入输出的 shape。但中间的每一步 shape 变化仍然需要显式标注，以降低读者理解难度。

### 示例:标注 body 内的 shape 变化

```python
def attention_scores(queries: NDArray, keys: NDArray) -> NDArray:
    """Scaled dot-product attention scores.

    Args:
        queries: ``[B, T, D]`` query vectors.
        keys: ``[B, T, D]`` key vectors.

    Returns:
        ``[B, T, T]`` per-pair scores.
    """
    keys_t = keys.transpose(0, 2, 1)    # [B, D, T]
    scores = queries @ keys_t           # [B, T, T]
    return scores / np.sqrt(queries.shape[-1])
```

## Name shape dimensions with the conventional letters

shape 维度用一套固定字母，遵守惯例:

- `N`:主数据长度(序列长度、样本数)
- `*N`:variadic——0 或任意个前导维度。用于既支持 `[3]` 单元素也支持 `[N, 3]` 多元素的函数
- `B`:batch(训练 loader 拆出的批次)
- `K`:选出的子集大小,或 mode 数量
- `H, W, C`:图像高 / 宽 / 通道
- 固定尺寸直接写数字:`[3]` / `[4]`

总是只用一个大写字母。如果可能存在理解问题或歧义，进行补充注释。

## Reuse a letter to express shape constraints

多参数间的 shape 关系,复用同一字母显式表达。

用同样的字母表达不同参数间的 shape 约束。更加简洁直观。

### 示例:复用 N 表达对齐

```
Args:
    points: ``[N, 3]`` world positions.
    weights: ``[N]`` per-point weights, aligned with ``points``.
```

## Lead a property docstring with its shape

property 和短方法用一行 docstring,shape 元组放最前面,后面紧跟语义。

### 示例:property docstring

```python
@cached_property
def coordinates(self) -> NDArray[np.float64]:
    """``[N, 3]`` world position (right-handed: X=north, Y=west, Z=up)."""

@cached_property
def speeds(self) -> NDArray[np.float64]:
    """``[N]`` speed in m/s."""
```

## Declare shared letters in the class docstring

类里多个属性共享 N / K 等维度时,在 class docstring 里一次性说清楚。

声明过一次后,每个 property 的 `[N, ...]` 就不必各自重复解释 N 是什么。

### 示例:class docstring 声明 N

```python
class PointCloud:
    """A batch of 3D points with optional per-point features.

    All per-point arrays are length ``N = len(self)`` and share the same
    point ordering.
    """
```
