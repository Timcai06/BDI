# AGENTS 文档入口

## 目的

本文件夹用于存放桥梁病害识别项目的核心知识文档，作为项目的统一参考入口。

目标是让任何参与开发的人或 AI 在开始工作前，先阅读这些文档，再进行设计、编码、联调或优化，避免项目方向漂移。

当前执行要求：

- 在开始任何开发任务前，先以 `AGENTS/` 文档为第一参考源确认约束与阶段状态
- 如果实现状态发生变化，应优先回写 `AGENTS/` 与 `plan/`，再继续新增开发
- 任何阶段切换都必须同步更新入口、计划与记忆文档，避免文档漂移

补充说明：

- 根目录文档主要用于项目负责人个人整理、分析和判断
- `AGENTS/` 文档主要用于 Codex 或其他智能体在工作时读取和遵循
- 当根目录文档与 `AGENTS/` 文档同时涉及实现约束时，智能体默认以 `AGENTS/` 文档为直接执行参考

## 目录结构

- `00-entry/`
  - 入口与阅读说明
- `01-product/`
  - 产品目标、需求和流程
- `02-architecture/`
  - 技术栈、前后端结构与兼容策略
- `03-execution/`
  - 实施顺序与阶段推进
- `04-memory/`
  - 当前进度与过程经验

## 阅读顺序

建议按以下顺序阅读：

1. `../01-product/01-core-goals.md`
2. `../01-product/02-prd.md`
3. `../01-product/03-app-flow.md`
4. `../02-architecture/04-tech-stack.md`
5. `../02-architecture/06-backend-structure.md`
6. `../02-architecture/07-architecture-compatibility.md`
7. `../02-architecture/05-frontend-guidelines.md`
8. `../03-execution/08-implementation-plan.md`
9. `../04-memory/09-progress.md`
10. `../04-memory/10-lessons.md`

## 最小阅读集

如果是智能体首次进入项目，且当前任务不是文档治理而是实现、联调或排查问题，建议至少先阅读以下 5 份文档：

1. `../01-product/01-core-goals.md`
2. `../01-product/02-prd.md`
3. `../02-architecture/04-tech-stack.md`
4. `../02-architecture/06-backend-structure.md`
5. `../02-architecture/07-architecture-compatibility.md`

读完以上内容后，应已经能够理解：

- 这个项目要做成什么
- 当前技术栈是什么
- 前后端与算法如何分层
- 模型升级时哪些接口不应被破坏

如果任务涉及前端交互和展示，再补读：

- `../01-product/03-app-flow.md`
- `../02-architecture/05-frontend-guidelines.md`

如果任务涉及阶段判断、接手延续或计划推进，再补读：

- `../03-execution/08-implementation-plan.md`
- `../04-memory/09-progress.md`
- `../04-memory/10-lessons.md`

如果任务正式进入新阶段，还应同步检查：

- `../../plan/README.md`
- `../../plan/phase2/README.md`
- `../../plan/phase2/kickoff-checklist.md`
- `../../plan/phase3.md`

## 使用规则

### 1. 文档优先，代码第二

在改任何代码之前，先确认需求、流程、技术栈、前后端约束和当前进度。

### 2. 以 01 为最高目标约束

`../01-product/01-core-goals.md` 是整个项目的北极星文档。任何新方案都不能偏离其中定义的核心目标。

### 3. 以协议和结构约束实现

前后端与算法对接时，必须遵循：

- `../02-architecture/06-backend-structure.md`
- `../02-architecture/07-architecture-compatibility.md`

### 4. 先更新文档，再扩展实现

如果项目方向、接口、技术选型或实现顺序发生变化，应先更新相关文档，再继续开发。

### 5. 每次重要变更后更新进度

每完成一个阶段性功能、做出一个关键技术决策或修复一个重要问题，都应更新：

- `../04-memory/09-progress.md`
- `../04-memory/10-lessons.md`

### 6. 阶段切换时同步更新计划文档

当 `Phase 2 -> Phase 3` 这类阶段状态发生变化时，至少同步更新：

- `../../README.md`
- `../../plan/README.md`
- `../../plan/phase2/README.md`
- `../../plan/phase2/kickoff-checklist.md`
- `../../plan/phase3.md`

## 当前项目定位

本项目是一个面向无人机桥梁巡检场景的病害识别系统原型。

项目第一阶段以 `YOLOv8` 为核心推理引擎，目标不是只做一个检测脚本，而是做一个：

**可兼容 YOLOv8 及其优化变体的推理框架，并具备前后端产品化展示能力的系统原型。**
