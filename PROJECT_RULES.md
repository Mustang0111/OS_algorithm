# AI开发规则（必须严格遵守）

## 1. Shell 规范
- 所有命令必须基于 Windows PowerShell 语法执行
- 禁止使用 bash / Linux 风格语法（如 &&、||、; 链式命令）
- 不允许使用 && 进行命令连接
- 多条命令必须拆分为独立行执行

## 2. PowerShell 兼容要求
- 多命令执行使用换行分隔
- 如必须单行执行，仅允许使用 PowerShell 支持的分隔符 ";"
- 禁止使用任何非 PowerShell 原生命令语法

## 3. 环境约束
- 默认运行环境：Windows + PowerShell
- 所有命令必须在 PowerShell 5+ 兼容范围内
- 不假设 Linux / bash / zsh 环境存在

## 4. 工程执行规范
- 每次执行命令前必须保证语法兼容当前 Shell
- 如果存在不兼容写法，必须自动转换为 PowerShell 写法
- 优先保证命令可执行，而不是简洁性

## 5. 强制约束（最高优先级）
- 禁止出现 "&&" 命令链
- 禁止生成 bash 风格命令
- 违反上述规则时必须自动修正为 PowerShell 版本