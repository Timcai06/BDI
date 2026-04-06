# Developer Quickstart

## 目标

这份文档只回答三个问题：

1. 怎么启动项目
2. 真实运行时依赖放在哪
3. 前后端契约如何同步

## 启动模式

- `bdi run`
  - 启动前端 + 真实后端
  - 依赖 `backend/.venv-yolo`
- `bdi run mock`
  - 启动前端 + mock 后端
  - 依赖 `backend/.venv`

## 环境边界

- `frontend/.env.local`
  - 只放前端公开变量，如 `NEXT_PUBLIC_API_BASE_URL`
- 后端环境变量
  - 统一在 `backend` 进程中读取，如数据库、模型、任务 worker 配置
- 模型运行时
  - 主模型 runtime：`backend/external_runtimes/prnet_ultralytics`
  - 渗水专项 runtime：`backend/external_runtimes/water_ultralytics`

## 依赖安装

- 基础后端依赖
  - `backend/requirements.txt`
- 真实后端依赖
  - `backend/requirements-yolo.txt`
- 前端依赖
  - `frontend/package.json`

## 类型同步

前端核心业务类型不再手写维护，统一从后端 OpenAPI 生成：

```bash
rtk npm --prefix frontend run generate:types
```

生成产物：

- OpenAPI schema：`artifacts/openapi/frontend-openapi.json`
- TypeScript 类型：`frontend/src/lib/api/generated.ts`

业务代码仍然通过 `frontend/src/lib/types.ts` 引用类型；该文件现在只是生成类型的门面层。

## 延伸文档

- 架构总览：`docs/architecture-overview.md`
- 运行时说明：`docs/runtime-guide.md`
- 故障排查：`docs/troubleshooting.md`
- 安全准备清单：`docs/security-readiness.md`

## 启动前检查

真实模式下至少确认：

1. `backend/.venv-yolo` 存在
2. `backend/models/best-latest-main.pt` 存在
3. `backend/models/best-latest-water.pt` 存在
4. `backend/external_runtimes/prnet_ultralytics` 存在
5. `backend/external_runtimes/water_ultralytics` 存在

缺一项时，不应直接进入真实模式。
