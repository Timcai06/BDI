# IMPLEMENTATION PLAN

## 作用

这份文档只回答：现在做到哪、下一步做什么、做到什么算完成。

## 阶段一：文档与结构

- 明确项目核心目标
- 明确产品需求
- 明确前后端与算法边界
- 明确接口协议与兼容策略

## 阶段二：MVP 闭环

- 单张图像上传
- `YOLOv8` 推理
- 统一结果 `JSON`
- 原图与 `Mask` 叠加
- 结果导出

### 结论

- `Phase 2` 已完成
- 当前已进入 `Phase 3`

## 阶段三：结果展示增强与系统稳定化

- 完善结果页
- 增加病害详情
- 增加筛选联动
- 增加 `overlay` / `JSON` 导出
- 增加统一错误状态
- 增加历史结果基础能力

### 结论

- `Phase 3` 已完成
- 系统具备稳定单图演示能力

## 阶段四：兼容优化模型与批量能力

- 模型版本注册
- 统一 `runner / adapter`
- 模型版本切换
- 批量任务
- `sliced` 推理
- 量化字段

### 结论

- `Phase 4` 已全部完成：多模型骨架、第二模型验证机制、批量与可用性提示已落地
- 当前已进入 `Phase 5`

## 阶段五：真实巡检业务流程系统化

- 以 `batch workflow` 重构后端领域模型与数据链路
- 引入数据库（目标 `PostgreSQL`）承接结构化查询能力
- 支持批量图片接入、任务异步处理、状态追踪和失败重试
- 支持识别结果与检测明细落库
- 提供批次统计、病害检索、人工复核和预警事件扩展位

### 当前阶段进展（已确认）

- 已完成 `SQLAlchemy + Alembic + psycopg` 基础接入
- 已完成核心表结构与迁移：`bridge / inspection_batch / media_asset / batch_item / inference_task / inference_result / detection / review_record / alert_event`
- 已完成 `/api/v1/bridges`、`/api/v1/batches`、`/api/v1/batch-items`、`/api/v1/tasks` 基础接口
- 已完成本地异步 worker 轮询与任务重试机制
- 已完成批次统计接口与 Phase 5 后端核心测试

### 下一步执行顺序

1. 完成企业化 dashboard 主入口改造（默认进入 `ops` 流程）
2. 完成 `批次中心 / 病害检索 / 复核中心 / 告警中心 / 设置` 页面骨架与导航收口
3. 完成 `detections / reviews / alerts` 业务 API 与前端页面联调收口
4. 完善数据库检索与复核、预警状态流转
