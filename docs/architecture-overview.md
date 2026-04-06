# Architecture Overview

## 目标

这份文档只说明四件事：

1. 浏览器请求如何进入系统
2. 任务如何从批次入库流向推理
3. 多 runtime 模型如何隔离运行
4. 结果如何回到前端详情页

## 系统分层

### 1. 前端

- 路径：`frontend/`
- 责任：
  - 承接桥梁、批次、历史、详情、运营总览 UI
  - 调用 `frontend/src/lib/predict-client.ts`
  - 消费后端 OpenAPI 生成类型 `frontend/src/lib/api/generated.ts`

### 2. Web/API 后端

- 路径：`backend/app/`
- 责任：
  - 暴露 `/api/v1/*`、`/results/*`、`/health`
  - 处理桥梁、批次、任务、结果、告警、复核
  - 统一类别归一化与响应 schema

### 3. 任务执行层

- 核心入口：
  - `backend/app/services/batch_ingest_service.py`
  - `backend/app/services/task_execution_service.py`
  - `backend/app/services/task_enhancement_service.py`
  - `backend/app/services/batch_aggregate_service.py`
- 责任：
  - 接收上传素材
  - 生成 `BatchItem` / `InferenceTask`
  - 调用 runner 执行推理
  - 写回 `InferenceResult` / `Detection`
  - 刷新批次聚合状态

### 4. 模型 runtime

- 主模型 runtime：`backend/external_runtimes/prnet_ultralytics`
- 渗水专项 runtime：`backend/external_runtimes/water_ultralytics`
- 增强模型：由 `enhance_runner` 封装接入

设计原则：

- API 进程不直接依赖某一个 Ultralytics 版本的全局 import 状态
- 不同模型 runtime 可以独立升级
- 统一通过 runner 输出标准 `RawDetection` / `PredictResponse`

## 核心链路

### 批次入库

1. 前端调用 `POST /api/v1/batches/{id}/items`
2. `batch_ingest_service` 校验上传内容、去重、落盘
3. 创建 `MediaAsset`、`BatchItem`、`InferenceTask`
4. 调用 `batch_aggregate_service` 刷新批次统计

### 任务执行

1. worker 取出 queued task
2. `task_execution_service.execute_task()` 解析原图并选择模型
3. runner 返回标准化检测结果
4. 结果写入 `InferenceResult`、`Detection`
5. 若开启增强，再走增强图二次推理
6. 刷新批次聚合状态

### 结果展示

1. 详情页通过 `/api/v1/batch-items/{id}/result` 取结构化结果
2. 图像与 overlay 通过 `/results/{id}/*` 或 artifact path 获取
3. 前端只做展示层过滤、排序、对比，不再自己归一化类别

## 当前工程约束

- 类别归一化事实源在后端 `normalize_defect_category()`
- 前端业务类型以 OpenAPI 生成类型为基础
- 超过维护阈值的大组件优先拆展示壳，不先改状态模型
- runtime 相关依赖必须留在对应层，不允许再次回到“桌面路径硬编码”模式
