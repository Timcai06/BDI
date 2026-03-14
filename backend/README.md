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

## 当前接口

- `GET /health`
- `GET /models`
- `POST /predict`
- `GET /results`
- `GET /results/{image_id}`
- `GET /results/{image_id}/overlay`
- `GET /results/{image_id}/image`
- `DELETE /results/{image_id}`

## 当前状态

当前默认仍可使用 mock runner，但真实单图链路已完成验收。

已确认：

- `GET /health` 可返回 `200`
- `POST /predict` mock 路径测试通过
- `pytest` 17/17 通过
- `ruff check .` 通过
- `.venv-yolo` 中 `ultralytics + torch` 可正常导入
- 真实 `YOLOv8-seg` 单图推理链路已完成联调验证
- 标准 JSON 与 overlay 产物已完成联调验证
- 结果列表、详情、原图、overlay 与删除接口测试通过

已实现并已完成真实验收：

- 通过环境变量选择真实 `YOLOv8-seg` runner
- 将 Ultralytics 原始结果转换为统一协议
- 生成 overlay 与标准 JSON 产物
- 后端代码已修正为兼容 `Python 3.9`
- 已验证新增多模型骨架在 `.venv-yolo` 的 `Python 3.9` 环境中可正常 import、测试和编译

## 真实模型接入

如果你已经有本地 `YOLOv8-seg` 权重，可以通过环境变量切换到真实 runner：

```bash
python3.9 -m venv .venv-yolo
source .venv-yolo/bin/activate
python3 -m pip install -r requirements-dev.txt
python3 -m pip install -r requirements-yolo.txt
export BDI_MODEL_WEIGHTS_PATH=/absolute/path/to/your-model.pt
export BDI_MODEL_VERSION=v1-real
export BDI_MODEL_DEVICE=cpu
export BDI_EXTRA_MODELS='[{"model_version":"mock-v2","backend":"mock","runner_kind":"mock"},{"model_version":"v2-real","backend":"pytorch","weights_path":"/absolute/path/to/your-second-model.pt"}]'
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
  {"model_version":"v2-real","backend":"pytorch","weights_path":"/absolute/path/to/your-second-model.pt"}
]'
```

当前前端可通过 `GET /models` 读取可选模型版本列表，并在发起 `/predict` 时传入 `model_version`。

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
