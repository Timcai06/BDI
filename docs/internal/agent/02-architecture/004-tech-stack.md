# TECH STACK

## 作用

这份文档只列出当前允许使用的技术和约束。

## 前端

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Framer Motion`
- `react-markdown`（LLM 诊断报告渲染）
- `Vitest`（前端测试）

## 后端

- `FastAPI`
- `Pydantic`
- `SQLAlchemy 2.0`
- `Alembic`
- `psycopg`（PostgreSQL 驱动）
- `OpenAI`（LLM智能诊断API调用）
- `opencv-python-headless`（图像处理）
- `python-dotenv`（环境变量配置）
- 基础开发环境可使用较新 Python 版本
- 真实模型联调与运行环境以 `Python 3.9` 到 `Python 3.12` 为准

## 算法

- `Ultralytics YOLOv8-seg`
- 第一阶段采用 `Python` 内嵌推理
- 可扩展到 `ONNX Runtime`
- 可扩展到 `TensorRT`
- 可结合 `SAHI` 做切片推理

## 存储

- PostgreSQL（生产）/ SQLite（开发）：结构化数据（桥梁、批次、任务、检测、复核、告警、审计）
- 本地文件存储：原始图片、JSON 结果、叠加图产物
- 结构上预留未来接 `Supabase` 或其他 BaaS

## 部署

- 第一阶段采用本地单机原型
- 前后端和模型可在一台机器上联调
- 代码结构保持分层，便于后续拆分

## 开发约束

- 先单体原型，后逻辑分层
- 先保证 MVP，后扩展性能
- 先统一协议，后增加模型版本
- 先本地存储，后按需接 BaaS
- 新增后端代码避免引入仅 `Python 3.10+` 可用的语法，尤其是 `X | Y`
