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

其中 `PRNET-main/` 应视为模型工程目录，而不是最终权重命名方式。只有导出的可推理权重文件才进入 `backend/models/`。

如果你要立即做“双模型融合”，推荐把融合模型本身也注册成一个独立版本，而不是新开 API。

推荐职责划分：

- `v1-legacy-general` 或 `v3-prnet-general` 负责通用病害
- `v2-seepage-specialist` 只负责 `seepage`
- `fusion-v1` 作为最终对外使用的融合版本

如果你已经有本地 `YOLOv8-seg` 权重，可以通过环境变量切换到真实 runner：

```bash
python3.9 -m venv .venv-yolo
source .venv-yolo/bin/activate
python3 -m pip install -r requirements-dev.txt
python3 -m pip install -r requirements-yolo.txt
export BDI_MODEL_WEIGHTS_PATH=/absolute/path/to/repo/backend/models/legacy-general-best.pt
export BDI_MODEL_VERSION=v1-legacy-general
export BDI_MODEL_DEVICE=cpu
export BDI_EXTRA_MODELS='[
  {"model_version":"mock-v2","backend":"mock","runner_kind":"mock"},
  {
    "model_version":"v2-seepage-specialist",
    "backend":"pytorch",
    "weights_path":"/absolute/path/to/repo/backend/models/seepage-specialist-best-20260328.pt",
    "supports_masks":false
  },
  {
    "model_version":"v3-prnet-general",
    "backend":"pytorch",
    "weights_path":"/absolute/path/to/repo/backend/models/prnet-general-best-20260328.pt",
    "supports_masks":false
  },
  {
    "model_version":"fusion-v1",
    "model_name":"dual-model-fusion",
    "backend":"fusion",
    "runner_kind":"fusion",
    "primary_model_version":"v3-prnet-general",
    "specialist_model_version":"v2-seepage-specialist",
    "specialist_categories":["seepage"],
    "supports_masks":false,
    "supports_sliced_inference":false
  }
]'
```

推荐使用 `Python 3.9` 到 `Python 3.12` 的虚拟环境安装 `ultralytics`。

同时需要注意：

- 真实模型环境当前以 `.venv-yolo` 的 `Python 3.9` 兼容性为硬约束
- 后端新增代码应避免引入仅 `Python 3.10+` 才支持的语法
- 特别是 `Path | None`、`str | None` 这类联合类型写法，应统一改用 `Optional[...]`

如果你在 `Python 3.9` 环境中遇到 `NumPy 2.x` 与 `torch`/`ultralytics` 的兼容报错，请重新安装：

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pip install -r requirements-yolo.txt
```

当前 `requirements-yolo.txt` 已显式约束 `numpy<2`，用于避免已验证到的 `torch 2.2.2 + NumPy 2.0.2` 导入兼容问题。

未配置权重路径、权重不可用，或真实依赖未安装时，后端会自动回退到 mock runner，保持前后端协议可联调。

如果你需要在同一个后端中注册多个模型版本，可以使用 `BDI_EXTRA_MODELS`。

推荐格式如下：

```bash
export BDI_EXTRA_MODELS='[
  {"model_version":"mock-v2","backend":"mock","runner_kind":"mock"},
  {
    "model_version":"v2-seepage-specialist",
    "backend":"pytorch",
    "weights_path":"/absolute/path/to/repo/backend/models/seepage-specialist-best-20260328.pt",
    "supports_masks":false
  },
  {
    "model_version":"v3-prnet-general",
    "backend":"pytorch",
    "weights_path":"/absolute/path/to/repo/backend/models/prnet-general-best-20260328.pt",
    "supports_masks":false
  },
  {
    "model_version":"fusion-v1",
    "model_name":"dual-model-fusion",
    "backend":"fusion",
    "runner_kind":"fusion",
    "primary_model_version":"v3-prnet-general",
    "specialist_model_version":"v2-seepage-specialist",
    "specialist_categories":["seepage"],
    "supports_masks":false,
    "supports_sliced_inference":false
  }
]'
```

当前前端可通过 `GET /models` 读取可选模型版本列表，并在发起 `/predict` 时传入 `model_version`。

后续在系统里区分模型时，应优先依赖 `model_version` 和 `weights_path`，不要再依赖模糊的 `best.pt` 文件名。

当前融合逻辑采用“类别级接管”：

- 通用模型保留非 `seepage` 结果
- `seepage` 优先使用专项模型结果
- 如果专项模型没有检出 `seepage`，则回退到通用模型的 `seepage`

需要注意：

- 你现在手头这批权重是 `detect`，不是 `segment`
- 因此建议在配置里显式写 `supports_masks=false`
- 当前 `fusion-v1` 主要服务于框级识别融合，不承担真实掩膜输出

本轮兼容性验证补充结论：

```bash
./.venv-yolo/bin/python -c "import app.main; print('import-ok')"
./.venv-yolo/bin/python -m pytest
PYTHONPYCACHEPREFIX=/tmp/bdi-pyc ./.venv-yolo/bin/python -m compileall app
```

以上检查已通过，说明当前 `backend/app` 在 `Python 3.9` 真实模型环境中可正常导入、测试和编译。

## 当前结论

后端的 mock MVP 闭环已经完成并通过基础验证；真实 runner 的代码路径、`Python 3.9` 兼容性、依赖导入和单图真实推理链路也已完成验收。除此之外，后端还已经落地了基于本地文件的结果管理能力，包括结果列表、详情读取、原图回看、overlay 下载和删除接口。

按当前真实代码判断，后端不再只是“为 Phase 3 提供基础能力”，而是已经完成了 Phase 3 中历史回看与结果导出的后端基础设施，当前重点更偏向演示稳定性、前后端体验细化和文档同步。
