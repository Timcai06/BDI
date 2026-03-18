# BDI

桥梁病害识别系统原型。

这是一个面向无人机桥梁巡检场景的 AI 识别系统，目标不是只跑通一个模型，而是把“图像输入 -> 病害识别 -> 结果展示 -> 结构化导出 -> 历史回看”做成一个可持续演进的产品原型。

## 快速开始

日常开发最常用的是这几条命令：

```bash
bdi run
```

同时启动前端和后端的默认入口。

```bash
bdi run mock
```

启动 mock 后端，适合前端联调和界面预览。

```bash
bdi status
```

查看当前前后端状态。

```bash
bdi stop
```

停止当前运行中的服务。

如果你想单独启动某一部分，可以直接用脚本：

```bash
./scripts/dev-frontend.sh
./scripts/dev-backend-mock.sh
./scripts/dev-backend-real.sh
./scripts/dev-check.sh
```

## 这个项目是什么

BDI 不是一个单纯的检测脚本，而是一个桥梁病害识别系统原型。当前系统围绕以下闭环组织：

- 图像输入
- 模型推理
- 结果标准化
- 可视化展示
- 结构化导出

设计上优先保证三件事：

- 当前能稳定接入 `YOLOv8-seg`
- 后续能兼容更换权重和优化模型
- 前后端协议保持稳定，便于演示和扩展

## 当前状态

目前仓库已经进入文档与可运行原型并行推进阶段。

### 已完成的核心能力

- `Phase 2` 已完成并通过真实单图链路验收
- `Phase 3` 已完成，结果展示、导出、历史回看等能力已落地
- `Phase 4` 已完成第一轮多模型骨架建设
- `GET /health`、`POST /predict` 与结果管理接口闭环
- overlay 文件保存与结果导出能力
- 前端基础展示、历史回看、模型对比与结果联动
- 后端 `pytest`、`ruff check`、前端 `test / lint / build` 均已验证

### 当前继续推进的重点

- 接入第二个真实模型版本
- 验证“同类模型换权重即可切换”的路径
- 继续增强 `mask` 可视化表达
- 推进批量能力与更完善的比赛展示效果

## 仓库结构

```text
.
├── AGENTS/      # 面向智能体/执行者的项目知识文档
├── backend/     # FastAPI 后端骨架与测试
├── frontend/    # Next.js 前端骨架与测试
├── for_crt/     # 根目录历史分析文档与项目方针
├── plan/        # 分阶段开发计划
└── README.md    # 项目入口说明
```

### 目录说明

#### `AGENTS/`

- 产品目标、架构约束、前后端边界、实施顺序与阶段记忆
- 后续开发时优先参考这里的文档约束
- 更适合作为实现阶段的直接执行依据

#### `for_crt/`

- 根目录原始分析文档和项目方针补充材料
- 更偏项目负责人视角的思考与背景判断

#### `plan/`

- 整体目标和各阶段开发任务
- 推荐按 `phase1 -> phase5` 顺序推进
- `phase2/` 与 `phase3/` 已补充执行说明与开工清单

## 推荐阅读顺序

如果你是第一次进入项目，建议按下面的顺序阅读：

1. [AGENTS/00-entry/AGENTS.md](./AGENTS/00-entry/AGENTS.md)
2. [product-landing-research.md](./product-landing-research.md)
3. [today-work-and-project-overview.md](./today-work-and-project-overview.md)
4. [model-system-relationship.md](./model-system-relationship.md)
5. [new-model-integration-playbook.md](./new-model-integration-playbook.md)
6. [plan/overall-goals.md](./plan/overall-goals.md)
7. [plan/phase4.md](./plan/phase4.md)
8. [for_crt/02-系统架构草案.md](./for_crt/02-系统架构草案.md)
9. [for_crt/03-YOLOv8对接协议与兼容设计.md](./for_crt/03-YOLOv8对接协议与兼容设计.md)

如果你是来直接开工实现，先看 `AGENTS/00-entry/AGENTS.md`，再进入阶段计划和代码。

## 开发原则

- 先完成 MVP，再逐步增强
- 先统一协议，再接入更多模型版本
- 先本地单机原型，再考虑复杂部署
- 先保证展示与联调闭环，再做高级优化

## 为什么这样安排

这个项目最容易踩的坑，不是模型效果本身，而是系统太早和某个模型细节绑死。

所以开发顺序不是随便排的，而是为了：

- 先定协议，避免前后端和算法互相等待
- 先搭骨架，避免后续每次换模型都返工
- 先做单图闭环，避免一开始就把批量、历史、量化全部压进第一版

## 下一步

下一步建议在当前多模型骨架基础上，把 `Phase 4` 做实：

- 接入第二个真实模型版本
- 验证“换权重 + 少量配置”是否足以完成同类模型切换
- 推进批量任务
- 继续保持前后端统一协议稳定

推荐实际开发顺序：

1. 先阅读 `AGENTS/` 与当前阶段计划文档
2. 再确认当前多模型骨架与统一结果协议
3. 先接入第二个真实模型版本做验证
4. 再推进批量任务等 `Phase 4` 能力
5. 最后推进更高阶展示和演示优化

## 备注

- 基础开发环境仍可使用当前 `Python 3.14`
- 真实 `ultralytics` 模型依赖建议在 `Python 3.9` 到 `Python 3.12` 的虚拟环境中安装
- 当前仓库不包含实际权重文件，未配置时后端会自动回退到 mock runner
- 当前 `.venv-yolo` 已完成 `numpy<2` 调整，并已验证 `ultralytics + torch` 可导入
- 所有开发任务开始前，应先参考 `AGENTS/` 目录确认约束与当前阶段，避免文档漂移
