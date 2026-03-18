# TECH STACK

## 作用

这份文档只列出当前允许使用的技术和约束。

## 前端

- `Next.js`
- `TypeScript`
- `Tailwind CSS`

## 后端

- `FastAPI`
- `Pydantic`
- 基础开发环境可使用较新 Python 版本
- 真实模型联调与运行环境以 `Python 3.9` 到 `Python 3.12` 为准

## 算法

- `Ultralytics YOLOv8-seg`
- 第一阶段采用 `Python` 内嵌推理
- 可扩展到 `ONNX Runtime`
- 可扩展到 `TensorRT`
- 可结合 `SAHI` 做切片推理

## 存储

- 第一阶段以本地文件存储为主
- 保存 `JSON` 结果文件
- 保存可视化叠加图
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
