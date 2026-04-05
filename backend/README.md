# Backend

桥梁病害识别系统的后端骨架，负责：

- 接收前端上传请求
- 调用推理 runner
- 将原始结果适配为统一协议
- 保存标准 JSON 等本地产物

## 快速开始

1. 创建虚拟环境
2. 安装依赖
3. 启动开发服务

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

## 数据库（Phase 5）

后端已接入 `PostgreSQL + SQLAlchemy + Alembic` 基础骨架，后续批次任务系统将以数据库为主存储结构化数据。

常用命令：

```bash
alembic revision --autogenerate -m "init phase5 schema"
alembic upgrade head
```

关键环境变量：

- `BDI_DATABASE_URL`（示例：`postgresql+psycopg://your_local_pg_role@localhost:5432/bdi`，本机常见为你的系统用户名）
- `BDI_DATABASE_ECHO`（`true/false`）
- `BDI_TASK_WORKER_ENABLED`（`true/false`，`bdi run` 默认建议为 `true`）
- `BDI_TASK_WORKER_INTERVAL_SECONDS`（默认 `1.0`）
- `BDI_TASK_LEASE_SECONDS`（任务租约秒数，默认 `300`）
- `BDI_TASK_MAX_ATTEMPTS`（单个批次项最大尝试次数，默认 `3`）
- `BDI_ALERT_AUTO_ENABLED`（是否启用识别后自动预警，默认 `true`）
- `BDI_ALERT_COUNT_THRESHOLD`（单图病害数阈值，默认 `3`）
- `BDI_ALERT_CATEGORY_WATCHLIST`（重点病害类别，逗号分隔，默认 `seepage`）
- `BDI_ALERT_CATEGORY_CONFIDENCE_THRESHOLD`（重点病害置信度阈值，默认 `0.8`）

## 当前接口

- `GET /health`
- `GET /models`
- `POST /predict`
- `GET /results`
- `GET /results/{image_id}`
- `GET /results/{image_id}/overlay`
- `GET /results/{image_id}/image`
- `DELETE /results/{image_id}`
- `POST /api/v1/bridges`
- `GET /api/v1/bridges`
- `GET /api/v1/bridges/{bridge_id}`
- `POST /api/v1/batches`
- `GET /api/v1/batches`
- `GET /api/v1/batches/{batch_id}`
- `POST /api/v1/batches/{batch_id}/items`
- `GET /api/v1/batches/{batch_id}/items`
- `GET /api/v1/batches/{batch_id}/stats`
- `GET /api/v1/batch-items/{batch_item_id}`
- `GET /api/v1/batch-items/{batch_item_id}/result`
- `GET /api/v1/tasks/{task_id}`
- `POST /api/v1/tasks/process-next`
- `POST /api/v1/tasks/{task_id}/retry`
- `GET /api/v1/detections`
- `POST /api/v1/reviews`
- `GET /api/v1/reviews`
- `POST /api/v1/alerts`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/{alert_id}/status`

## 当前状态

当前默认仍可使用 mock runner，但真实单图链路已完成验收。

默认单图上传上限为 `30MB`，可通过 `BDI_MAX_UPLOAD_SIZE_BYTES` 环境变量覆盖。

已确认：

- `GET /health` 可返回 `200`
- `POST /predict` mock 路径测试通过
- `pytest` Phase 5 核心后端测试 19 通过，1 跳过（未配置集成 PostgreSQL）
- `ruff check .` 通过
- `.venv-yolo` 中 `ultralytics + torch` 可正常导入
- 真实 `YOLOv8-seg` 单图推理链路已完成联调验证
- 标准 JSON 与 overlay 产物已完成联调验证
- 结果列表、详情、原图、overlay 与删除接口测试通过

已实现并已完成真实验收：

- 通过环境变量选择真实 `YOLOv8-seg` runner
- 将 Ultralytics 原始结果转换为统一协议
- 生成 overlay 与标准 JSON 产物
- 在统一协议中显式返回 `has_masks` 与 `mask_detection_count`
- 对模型原始类别名执行六类标准化映射
- 后端代码已修正为兼容 `Python 3.9`
- 已验证新增多模型骨架在 `.venv-yolo` 的 `Python 3.9` 环境中可正常 import、测试和编译

## 当前结果协议补充说明

后端当前会在结果协议中显式返回实例掩膜能力：

- `has_masks: bool`
- `mask_detection_count: int`

这两个字段用于帮助前端区分：

- 当前结果是否真正包含实例分割掩膜
- 是否允许进入“掩膜图”视图

需要特别注意：

- `overlay` 是后端导出的可视化结果图产物
- `overlay` 不等于实例掩膜
- 真实掩膜能力应以 `detections[].mask`、`has_masks` 和 `mask_detection_count` 为准
- 返回给前端的 `category` 已在后端按六类标准值归一化，相关逻辑位于 `app/core/category_mapper.py`

## 真实模型接入

建议不要继续把不同版本权重都命名为 `best.pt`。

推荐把“用途”和“来源”直接写进文件名与模型版本：

- 老版本通用模型：`legacy-general-best.pt`
- 渗水专项模型：`seepage-specialist-best-20260328.pt`
- `PRNET-main` 导出的通用模型：`prnet-general-best-20260328.pt`

推荐目录约定：

```text
backend/models/
  legacy-general-best.pt
  seepage-specialist-best-20260328.pt
  prnet-general-best-20260328.pt
```

推荐版本名约定：

- `v1-legacy-general`
- `v2-seepage-specialist`
- `v3-prnet-general`
- `fusion-v1`

当前仓库采用“vendored runtimes + vendored weights”的双模型结构，不再依赖个人 `Desktop/` 或 `Downloads/` 目录。

目录约定：

- `backend/models/best-latest-main.pt`
  - 最新主模型权重
- `backend/models/best-latest-water.pt`
  - 最新渗水专项模型权重
- `backend/external_runtimes/prnet_ultralytics/`
  - 主模型运行时
- `backend/external_runtimes/water_ultralytics/`
  - 渗水专项模型运行时，兼容 `Segment26`

模型职责：

- `main-latest-mask-v1`
  - 全类别主分割模型
- `water-latest-mask-v1`
  - 渗水专项分割模型
- `fusion-main-water-mask-v1`
  - 最终对外使用的融合版本

推荐启动配置如下：

```bash
export BDI_MODEL_NAME='桥梁病害通用检测模型（兼容回退）'
export BDI_MODEL_VERSION='general-yolov8m-legacy'
export BDI_ACTIVE_MODEL_VERSION='fusion-main-water-mask-v1'
export BDI_MODEL_WEIGHTS_PATH='backend/models/bridge-defect-general-detector-yolov8m-20260321.pt'
export BDI_MODEL_DEVICE='cpu'
export BDI_EXTRA_MODELS='[
  {
    "model_name":"最新主模型",
    "model_version":"main-latest-mask-v1",
    "backend":"pytorch",
    "runner_kind":"external_ultralytics",
    "runtime_root":"backend/external_runtimes/prnet_ultralytics",
    "weights_path":"backend/models/best-latest-main.pt",
    "supports_masks":true,
    "supports_overlay":true
  },
  {
    "model_name":"最新渗水专项模型",
    "model_version":"water-latest-mask-v1",
    "backend":"pytorch",
    "runner_kind":"external_ultralytics",
    "runtime_root":"backend/external_runtimes/water_ultralytics",
    "weights_path":"backend/models/best-latest-water.pt",
    "supports_masks":true,
    "supports_overlay":true
  },
  {
    "model_name":"双模型融合识别",
    "model_version":"fusion-main-water-mask-v1",
    "backend":"fusion",
    "runner_kind":"fusion",
    "primary_model_version":"main-latest-mask-v1",
    "specialist_model_version":"water-latest-mask-v1",
    "specialist_categories":["seepage"],
    "supports_masks":true,
    "supports_overlay":true
  }
]'
```

实现说明：

- 新 runtime 通过子进程隔离加载，不污染当前后端进程中的默认 `ultralytics` 导入路径
- `main-latest-mask-v1` 使用 vendored `PRNet` 运行时
- `water-latest-mask-v1` 使用 vendored 水专项运行时
- `fusion-main-water-mask-v1` 继续使用类别级接管：
  - 非 `seepage` 保留主模型结果
  - `seepage` 优先保留专项模型结果
  - 专项未命中时回退主模型

物理尺寸说明：

- 新双模型都输出 `mask`
- 长度、宽度、面积统一基于 `mask` 计算
- 第一阶段继续沿用 `pixels_per_mm`
- 第二阶段再接无人机元数据换算

启动前检查：

1. `backend/models/best-latest-main.pt` 存在
2. `backend/models/best-latest-water.pt` 存在
3. `backend/external_runtimes/prnet_ultralytics/ultralytics` 存在
4. `backend/external_runtimes/water_ultralytics/ultralytics` 存在
5. 当前 Python 环境已安装后端依赖和 `ultralytics` 运行所需依赖

如果 runtime 或权重缺失，系统会在解析模型可用性时直接判定不可用，不进入“半可用”状态。
