# 根目录约束

## 目标

根目录只保留运行主链路入口和仓库级配置，避免把过程文档、外来资料和产物目录与主项目目录混在一起。

## 允许留在根目录的内容

- `backend/`
- `frontend/`
- `scripts/`
- `docs/`
- 仓库级配置文件：如 `.gitignore`、`README.md`、`bdi`

## 必须下沉归类的内容

- 代理/协作文档：放入 `docs/internal/`
- 阶段计划：放入 `docs/plan/`
- 外来参考资料或子仓库：放入 `docs/reference/` 或 `archive/`
- 构建、测试、运行产物：放入 `artifacts/` 或保留为 ignore 目录

## 当前目录约定

- `docs/internal/agent/`：原 `AGENTS/` 内容
- `docs/plan/`：原 `plan/` 内容
- `docs/reference/awesome-design-md/`：外来设计参考资料

## 不推荐的做法

- 直接在根目录新建新的流程性目录
- 将构建缓存、测试输出、截图、日志长期留在根目录
- 将外部资料仓库与主业务源码目录并列放置
