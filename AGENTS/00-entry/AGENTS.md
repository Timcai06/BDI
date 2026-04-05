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
5. `../02-architecture/006-backend-structure.md`（注：接口列表需对照 `app/api/routes.py` 和 `v1_routes.py` 实际代码）
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
- `Phase 4` 已全部完成：多模型骨架、双模型融合（通用+渗水专项）、批量与可用性提示已落地
- `Phase 5` 后端核心链路 + 前端 ops 工作台已基本收口：桥梁资产管理、批次工作流、异步任务、病害检索、人工复核、预警事件、运营指标
- `Phase 6` 已定义并进入优化实施阶段：业务稳定性与决策能力优化
- 当前重点：Phase 6 稳定性指标基线、规则引擎首版、critical finding 时效追踪、运营处置效率视图

## 最新 UI 状态

- 侧边栏新增"桥梁资产"导航入口（位于运营总览与批次工作台之间）
- 新增 `/dashboard/bridges` 桥梁资产列表页与 `/dashboard/bridges/[bridgeId]` 资产驾驶舱详情页
- Ops 工作台采用 Bento 式分步导航布局：左侧桥梁资产选择（第一阶段）→ 右侧批次工作台（第二阶段），中间动画箭头连接
- 批次摘要栏改为可折叠设计，含图标化指标卡片与动画进度条
- 巡检档案中心（历史页）新增桥梁资产筛选器与单图库切换按钮
- 全量页面完成中文化：英文标签替换为中文，按钮图标化，圆角统一升级至 `rounded-[2.5rem]`
- 全面接入 Framer Motion 动画：页面入场、状态提示、进度条、折叠面板
- 预测客户端增加 demo 降级：无后端时自动回退到演示产物路径
- **文案精简**：全量页面去除冗余修饰词，统一为简洁直白表述（"资产底座" → "桥梁"、"基础设施名录" → "桥梁名录"、"分析诊断实验室" → "详情"等）
- **素材列表（Item Grid）重设计**：状态 badge 中文化、选择操作栏改为条件显示 + AnimatePresence 折叠动画、表头全中文、分页器中文化
- **工作台骨架屏**：新增 `OpsWorkbenchSkeleton` 组件，使用 `AnimatePresence mode="wait"` 实现 skeleton → empty → content 三态平滑切换
- **通知自动消失**：notice 提示 3 秒后自动隐藏
- **性能优化**：移除部分面板的 `backdrop-blur` 以提升滚动性能

## 当前项目定位

本项目是面向无人机桥梁巡检场景的病害识别系统原型。
它不是单一模型 demo，而是一个可兼容 YOLOv8 及其优化变体的推理框架，外加产品化展示能力。
