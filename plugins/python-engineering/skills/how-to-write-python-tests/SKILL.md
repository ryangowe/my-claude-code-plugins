---
name: how-to-write-python-tests
description: Load when writing Python tests.
---

# How to write Python tests

## Co-locate each test file and name it after its module

测试文件放在它的 module 旁边,命名为 `<module>_test.py`。例如:`frame.py` → `frame_test.py`。

## Test interfaces, not implementation details

- public 符号: 只做接口性质的测试
- private 符号: 只对复杂 private 函数测试，且只测试正确性

绑在接口上的测试,在实现重构后仍然有效。

## Use fixtures, not helper functions

测试的前置准备(前置条件、共享对象、清理)用 pytest fixture 组织,不写 test helper 函数。

fixture 可组合、可复用,并能自动清理。

## Stay in pure pytest

- 纯 pytest,不用 `unittest.mock`;用 `monkeypatch` 代替 `patch`
- 用合成数据,不依赖线上数据或真实外部服务
