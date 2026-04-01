# AGENTS 文档入口

## 作用

这是 `AGENTS` 的唯一入口。
它的任务不是解释项目背景，而是让 AI 在动手前先知道：

- 先读什么
- 哪些规则必须遵守
- 当前阶段做到哪
- 哪些文档是事实源

## 读法

首次进入项目时，先读这些文档：

1. `../01-product/001-core-goals.md`
2. `../01-product/002-prd.md`
3. `../01-product/003-app-flow.md`
4. `../02-architecture/004-tech-stack.md`
5. `../02-architecture/006-backend-structure.md`
6. `../02-architecture/007-architecture-compatibility.md`
7. `../02-architecture/005-frontend-guidelines.md`
8. `../03-execution/008-implementation-plan.md`
9. `../04-memory/009-progress.md`
10. `../04-memory/010-lessons.md`

实现、联调、排查问题时，至少先读：

1. `../01-product/001-core-goals.md`
2. `../01-product/002-prd.md`
3. `../02-architecture/004-tech-stack.md`
4. `../02-architecture/006-backend-structure.md`
5. `../02-architecture/007-architecture-compatibility.md`

涉及前端展示时，再补：

- `../01-product/003-app-flow.md`
- `../02-architecture/005-frontend-guidelines.md`

涉及阶段推进时，再补：

- `../03-execution/008-implementation-plan.md`
- `../04-memory/009-progress.md`
- `../04-memory/010-lessons.md`

## 规则

- 改代码前先看 `AGENTS/`
- 先更新文档，再改实现
- 先守协议，再做展示
- 先守阶段，再扩能力
- 只写已确认事实，避免把“建议”写成“完成”
- 发生阶段变化时，同步更新 `plan/` 和 `04-memory/`

## 目录

- `01-product/` - 项目目标、需求、流程
- `02-architecture/` - 技术栈、分层、协议、兼容策略
- `03-execution/` - 阶段推进、完成定义、开工清单
- `04-memory/` - 当前进度、关键经验、易错点

## 当前判断

- `Phase 2` 已完成
- `Phase 3` 已完成
- `Phase 4` 已全部完成：多模型骨架、第二模型验证机制、批量与可用性提示已落地
- `Phase 5` 正式启动：真实巡检业务流程系统化
- 当前重点：批次工作流、异步任务链路、病害检索、复核与预警能力落地

## 当前项目定位

本项目是面向无人机桥梁巡检场景的病害识别系统原型。
它不是单一模型 demo，而是一个可兼容 YOLOv8 及其优化变体的推理框架，外加产品化展示能力。
