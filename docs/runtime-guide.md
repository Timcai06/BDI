# Runtime Guide

## 目标

说明真实模式下三类模型能力的运行边界：

- 主模型
- 渗水专项模型
- 图像增强模型

## 目录约定

- 主模型权重：`backend/models/best-latest-main.pt`
- 渗水专项权重：`backend/models/best-latest-water.pt`
- 主模型 runtime：`backend/external_runtimes/prnet_ultralytics`
- 渗水专项 runtime：`backend/external_runtimes/water_ultralytics`

## 依赖层

### 基础后端依赖

- 文件：`backend/requirements.txt`
- 用途：
  - FastAPI
  - SQLAlchemy
  - 基础服务与 schema

### 真实推理依赖

- 文件：`backend/requirements-yolo.txt`
- 用途：
  - 真实推理 worker
  - Ultralytics 相关依赖
  - 与 runtime 权重和 worker 进程配套

## 启动方式

### 推荐

```bash
bdi run
```

行为：

- 前端读取 `frontend/.env.local`
- 后端优先使用 `backend/.venv-yolo`
- 启动前检查模型与 runtime 目录是否存在

### Mock 模式

```bash
bdi run mock
```

用于：

- 纯 UI 调整
- 不依赖真实模型的页面联调

## 运行时边界

### 主模型 runtime

- 负责全类别通用检测
- 输出标准检测对象，支持 mask

### 渗水专项 runtime

- 只负责 seepage 专项增强
- 在 fusion 中作为 specialist 分支使用

### 增强模型

- 不替代原图识别
- 作为第二套正式结果来源
- 详情页通过 `secondary_result` 展示

## 启动前检查清单

进入真实模式前确认：

1. `backend/.venv-yolo` 存在
2. `backend/models/best-latest-main.pt` 存在
3. `backend/models/best-latest-water.pt` 存在
4. `backend/external_runtimes/prnet_ultralytics` 存在
5. `backend/external_runtimes/water_ultralytics` 存在
6. 数据库连接可用

## 禁止事项

- 不要再依赖 `~/Desktop` 或 `~/Downloads` 里的权重路径启动真实链路
- 不要把多个 runtime 混进单一 site-packages 再“碰运气”导入
- 不要在没有权重检查的情况下直接进入 real 模式
