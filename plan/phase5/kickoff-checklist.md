# Phase 5 开工清单

> 阶段核心目标：把项目从单图识别 demo 转到可支撑真实巡检业务流程的系统原型。

## 开工确认

- [x] `Phase 4` 多模型骨架与双模型融合路径已建立
- [x] 单图识别、结果展示、历史查看和导出能力已落地
- [x] 已确认下一阶段主语切换为 `batch workflow`
- [x] 已确认正式系统目标数据库为 `PostgreSQL`，本地开发兼容 `SQLite`

## 后端领域模型

- [x] 明确 `bridges` 表结构
- [x] 明确 `inspection_batches` 表结构
- [x] 明确 `media_assets` 表结构
- [x] 明确 `batch_items` 表结构
- [x] 明确 `inference_tasks` 表结构
- [x] 明确 `inference_results` 表结构
- [x] 明确 `detections` 表结构
- [x] 明确 `review_records` 表结构
- [x] 明确 `alert_events` 表结构

## API 与任务流转

- [x] 明确 `/api/v1/bridges` 相关接口
- [x] 明确 `/api/v1/batches` 相关接口
- [x] 明确 `/api/v1/tasks` 相关接口
- [x] 明确 `/api/v1/batch-items` 相关接口
- [x] 明确 `/api/v1/detections` 相关接口
- [x] 明确 `/api/v1/reviews` 相关接口
- [x] 明确 `/api/v1/alerts` 相关接口
- [x] 明确批次、任务、结果状态流转
- [x] 明确预警状态流转

## 数据与执行层

- [x] 引入数据库层与 ORM
- [x] 实现图片批次上传后的自动入队
- [x] 实现本地 worker 轮询与任务锁定
- [x] 实现识别结果与检测记录事务落库
- [x] 实现失败任务重试机制
- [x] 实现批次聚合统计

## 前端业务化改造

- [x] 明确批次列表页结构
- [x] 明确批次详情页结构
- [x] 明确单张图片详情页结构
- [x] 明确病害检索与预警页结构
- [x] 明确人工复核交互路径

## 文档同步

- [x] `AGENTS/03-execution/008-implementation-plan.md` 同步新阶段目标
- [x] `AGENTS/04-memory/009-progress.md` 同步当前重点转为业务流程系统化
- [x] `AGENTS/00-entry/AGENTS.md` 同步当前判断与阶段重点
- [x] `plan/README.md` 已改为新的 Phase 5 定位
