# TECH STACK

## 前端

- `Next.js`
- `TypeScript`
- `Tailwind CSS`

## 后端

- `FastAPI`
- 基础开发环境可使用较新 Python 版本
- 真实模型联调与运行环境以 `Python 3.9` 到 `Python 3.12` 为准
- `Pydantic`

## 算法与推理

- `Ultralytics YOLOv8-seg`
- 第一阶段采用 `Python` 内嵌推理
- 可扩展到 `ONNX Runtime`
- 可扩展到 `TensorRT`
- 可结合 `SAHI` 进行切片推理

## 数据与结果

- 第一阶段以本地文件存储为主
- JSON 结果文件
- 可视化叠加图
- 结构上预留未来接 `Supabase` 或其他 BaaS 的能力

## 部署形态

- 第一阶段采用本地单机原型
- 前后端和模型可在一台机器上联调
- 代码结构上保持逻辑分层，便于后续拆分

## 开发原则

- 先单体原型，后逻辑分层
- 先保证 MVP，后扩展性能
- 先统一协议，后增加模型版本
- 先本地存储，后按需要接 BaaS
- 新增后端代码需避免引入仅 `Python 3.10+` 可用的语法，特别是 `X | Y` 这类联合类型写法
