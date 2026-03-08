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
- `POST /predict`

## 当前状态

当前默认使用 mock runner。

已确认：

- `GET /health` 可返回 `200`
- `POST /predict` mock 路径测试通过
- `pytest` 7/7 通过
- `ruff check .` 通过
- `.venv-yolo` 中 `ultralytics + torch` 可正常导入

已实现但尚未完成真实验收：

- 通过环境变量选择真实 `YOLOv8-seg` runner
- 将 Ultralytics 原始结果转换为统一协议
- 生成 overlay 与标准 JSON 产物
- 后端代码已修正为兼容 `Python 3.9`

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
```

推荐使用 `Python 3.9` 到 `Python 3.12` 的虚拟环境安装 `ultralytics`。

如果你在 `Python 3.9` 环境中遇到 `NumPy 2.x` 与 `torch`/`ultralytics` 的兼容报错，请重新安装：

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pip install -r requirements-yolo.txt
```

当前 `requirements-yolo.txt` 已显式约束 `numpy<2`，用于避免已验证到的 `torch 2.2.2 + NumPy 2.0.2` 导入兼容问题。

未配置权重路径、权重不可用，或真实依赖未安装时，后端会自动回退到 mock runner，保持前后端协议可联调。

## 当前结论

后端的 mock MVP 闭环已经完成并通过基础验证；真实 runner 的代码路径、`Python 3.9` 兼容性和依赖导入也已确认，但真实权重推理尚未在当前仓库内完成验收，因此不能把真实模型接入视为已完成。
