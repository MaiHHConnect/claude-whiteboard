---
name: minimal-dependency-tool-selection
description: 执行任务时优先选择零依赖工具的工作流
version: 1.0.0
triggers:
  - 环境检测
  - 输出验证
  - 最小依赖
  - 工具选型
patterns: []
enabled: true
priority: 10
category: precipitated
extractedFrom: f1fb5783-ca21-4cbd-80fc-2ee220865f15
taskTag: 8
createdAt: 2026-04-15T02:31:08.525Z
---

# minimal-dependency-tool-selection

## 原始任务
确定执行环境与输出方式

## 使用场景
任何需要快速验证/输出的任务，特别是环境探索类任务

## 模式内容
```
1. 检测环境可用工具及版本
2. 评估各工具的依赖开销
3. 优先选择零依赖的工具（如 Shell 内置命令）
4. 执行并验证输出
```
