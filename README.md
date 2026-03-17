# BDI

桥梁病害识别系统原型项目。

## Quick Start

日常开发现在只需要记这几条：

一条命令同时启动前端和后端：

```bash
./scripts/dev.sh
```

如果要走 mock 后端：

```bash
./scripts/dev.sh mock
```

前端：

```bash
./scripts/dev-frontend.sh
```

后端 mock：

```bash
./scripts/dev-backend-mock.sh
```

后端真实模型：

```bash
./scripts/dev-backend-real.sh
```

检查本地环境是否准备好：

```bash
./scripts/dev-check.sh
```

这个仓库当前已经从纯文档仓进入“文档 + 可运行原型并行”的阶段。

你在这里能快速看清三件事：

- 这个项目要做成什么
- 为什么要先按系统而不是按单模型来设计
- 下一步该从哪里开始开发

## Project Overview

本项目面向无人机桥梁巡检场景，目标是构建一个可运行、可展示、可扩展的病害识别系统原型。

当前阶段以 `YOLOv8-seg` 作为核心推理引擎，围绕下面这条最小闭环推进：

- 图像输入
- 模型推理
- 结果标准化
- 可视化展示
- 结构化导出

这个项目的目标不是做一个绑定单一权重文件的 demo，而是先把系统骨架搭对：

- 当前能接入 `YOLOv8-seg`
- 后续能兼容优化后的模型版本
- 前后端协议尽量稳定
- 结果可以展示、解释、导出和复查

换句话说，我们优先做的是“可持续演进的识别系统原型”，而不是一次性的模型演示页。

## What This Repo Contains

当前仓库主要存放四类内容：

- 项目目标、架构和协议文档
- 分阶段开发计划
- 已落地并持续演进的 `backend/` 原型骨架
- 已落地并持续演进的 `frontend/` 原型骨架

当前更准确的状态是：

- `Phase 2` 已完成
- `Phase 3` 的用户侧闭环已基本成立
- `Phase 4` 已启动，并已完成第一轮多模型骨架建设

## Current Status

已经完成：

- 项目方向和比赛导向收敛
- 产品目标与需求文档整理
- 系统架构与模型兼容策略设计
- Phase 1 规划内容基本完成
- `FastAPI` 后端基础骨架
- `Next.js` 前端基础骨架
- `GET /health`、`POST /predict` 与结果管理接口闭环
- `plan/phase2/` 执行文档与开工清单
- `plan/phase3/` 执行文档与开工清单
- 可通过环境变量切换的真实 `YOLOv8-seg` runner 接入位
- overlay 文件保存能力
- 后端 `pytest` 17/17 通过
- 后端 `ruff check .` 通过
- 后端 `GET /health` 启动检查通过
- 前端 `test / lint / build` 通过
- 后端已修正为兼容 `Python 3.9` 的真实模型环境
- 已确认 `.venv-yolo` 中安装了 `ultralytics`
- 已确认 `.venv-yolo` 中 `ultralytics + torch` 可正常导入
- 已完成真实 `YOLOv8-seg` 单图推理联调验收
- 已完成浏览器侧上传到结果展示的完整链路验证
- 已确认前端可直接消费真实 runner 返回结果
- 已完成标准 JSON 与 overlay 产物联调验证

当前已完成或已具备：

- 更完整的结果页展示与说明表达
- overlay / JSON 导出入口
- 错误态、空态和失败反馈基础能力
- 本地历史结果基础回看能力
- 结果列表 / 详情 / 原图 / overlay / 删除接口
- 原图 / overlay 结果视图切换
- 更精确的结果框映射与展示
- 统一动作反馈提示与更清晰的按钮状态说明
- 首页、历史页、结果页主要文案已完成一轮统一
- 多模型注册、加载与切换骨架
- `GET /models` 模型列表接口
- 前端模型选择与模型版本展示
- 本地图片的双模型对比
- 历史记录结果的再次模型对比
- 图像级并排对比
- 病害类别级差异对比

当前进入 `Phase 4` 后，已完成的核心能力包括：

- `ModelSpec` / `ModelRegistry` / `RunnerManager` 骨架
- `model_name` 与 `model_version` 的基础分离
- `/predict` 按 `model_version` 选择 runner
- 多模型配置入口与 `.env` 示例
- `Python 3.9` 真实模型环境兼容修复
- 模型系统关系文档与新模型接入手册

当前仍值得继续推进的重点主要是：

- 继续做少量视觉和文案 polish
- 视需要补充更强的 mask 可视化表达
- 接入第二个真实模型版本，验证“同类模型换权重即可切换”
- 增加更清晰的模型可用性提示
- 继续推进 `sliced` 推理与 batch 能力

## Repository Structure

```text
.
├── AGENTS/      # 面向智能体/执行者的项目知识文档
├── backend/     # FastAPI 后端骨架与测试
├── frontend/    # Next.js 前端骨架与测试
├── for_crt/     # 根目录历史分析文档与个人项目方针
├── plan/        # 分阶段开发计划
└── README.md    # 项目入口说明
```

### Directory Notes

`AGENTS/`

- 用于存放产品目标、架构约束、前后端边界、实施顺序与阶段记忆
- 后续开发时优先参考这里的文档约束
- 更适合作为实现阶段的直接执行依据

`for_crt/`

- 用于存放根目录原始分析文档和项目方针补充材料
- 更偏项目负责人视角的思考与背景判断

`plan/`

- 用于记录整体目标和各阶段开发任务
- 推荐按 `phase1 -> phase5` 顺序推进
- `phase2/` 与 `phase3/` 已补充执行说明与开工清单

## Recommended Reading Order

如果是第一次进入项目，建议按下面的顺序读：

1. [AGENTS/00-entry/AGENTS.md](/Users/justin/Desktop/BDI/AGENTS/00-entry/AGENTS.md)
2. [product-landing-research.md](/Users/justin/Desktop/BDI/product-landing-research.md)
3. [today-work-and-project-overview.md](/Users/justin/Desktop/BDI/today-work-and-project-overview.md)
4. [model-system-relationship.md](/Users/justin/Desktop/BDI/model-system-relationship.md)
5. [new-model-integration-playbook.md](/Users/justin/Desktop/BDI/new-model-integration-playbook.md)
6. [plan/overall-goals.md](/Users/justin/Desktop/BDI/plan/overall-goals.md)
7. [plan/phase4.md](/Users/justin/Desktop/BDI/plan/phase4.md)
8. [for_crt/02-系统架构草案.md](/Users/justin/Desktop/BDI/for_crt/02-系统架构草案.md)
9. [for_crt/03-YOLOv8对接协议与兼容设计.md](/Users/justin/Desktop/BDI/for_crt/03-YOLOv8对接协议与兼容设计.md)

如果你是来直接开工实现，先看 `AGENTS/00-entry/AGENTS.md`，再进入阶段计划和代码。

## Development Principle

- 先完成 MVP，再逐步增强
- 先统一协议，再接入更多模型版本
- 先本地单机原型，再考虑复杂部署
- 先保证展示与联调闭环，再做高级优化

## Why The Order Matters

这个项目最容易踩的坑，不是模型没效果，而是系统太早和某个模型细节绑死。

所以这里的开发顺序不是随意安排的，而是有明确目的：

- 先定协议，避免前后端和算法同学互相等待
- 先搭骨架，避免后续每次换模型都返工
- 先做单图闭环，避免一上来就把批量、历史、量化全部压进第一版

## Next Step

下一步建议是在当前多模型骨架基础上，继续把 `Phase 4` 做实：

- 接入第二个真实模型版本
- 验证“换权重 + 少量配置”是否足以完成同类模型切换
- 增加更清晰的模型可用性提示
- 推进 `sliced` 推理与 batch 能力
- 继续保持前后端统一协议稳定

推荐实际开发顺序：

1. 先阅读 `AGENTS/` 与当前阶段计划文档
2. 再确认当前多模型骨架与统一结果协议
3. 先接入第二个真实模型版本做验证
4. 再推进批量任务、切片推理等 `Phase 4` 能力
5. 最后再推进更高阶展示和演示优化

## Notes

当前仓库仍然以文档驱动为主，但已经具备真实单图闭环能力，也已经完成了 `Phase 4` 的第一轮模型接入层升级。

这意味着接下来的工作不再是“从零开始搭框架”，而是围绕统一协议，把已跑通的真实链路继续提升成真正可替换模型、可稳定演示、可持续扩展的系统原型。

补充说明：

- 基础开发环境仍可使用当前 `Python 3.14`
- 真实 `ultralytics` 模型依赖建议在 `Python 3.9` 到 `Python 3.12` 的虚拟环境中安装
- 当前仓库不包含实际权重文件，未配置时后端会自动回退到 mock runner
- 当前 `.venv-yolo` 已完成 `numpy<2` 调整，并已验证 `ultralytics + torch` 可导入
- 所有开发任务开始前，应先参考 `AGENTS/` 目录确认约束与当前阶段，避免文档漂移
