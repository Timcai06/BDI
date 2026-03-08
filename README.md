# BDI

桥梁病害识别系统原型项目。

这个仓库当前已经从纯文档仓进入“文档 + MVP 骨架并行”的阶段。

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
- 已落地的 `backend/` MVP 骨架
- 已落地的 `frontend/` MVP 骨架

当前处在“Phase 2 进行中，mock 闭环与本地基础验证已完成，真实 YOLOv8 runner 代码与依赖环境已就绪，但尚未完成真实权重验证”的状态。

## Current Status

已经完成：

- 项目方向和比赛导向收敛
- 产品目标与需求文档整理
- 系统架构与模型兼容策略设计
- Phase 1 规划内容基本完成
- `FastAPI` 后端基础骨架
- `Next.js` 前端基础骨架
- `GET /health` 与 `POST /predict` mock 闭环
- `plan/phase2/` 执行文档与开工清单
- 可通过环境变量切换的真实 `YOLOv8-seg` runner 接入位
- overlay 文件保存能力
- 后端 `pytest` 7/7 通过
- 后端 `ruff check .` 通过
- 后端 `GET /health` 启动检查通过，当前活跃 runner 为 `mock-runner`
- 前端 `test / lint / build` 通过
- 后端已修正为兼容 `Python 3.9` 的真实模型环境
- 已确认 `.venv-yolo` 中安装了 `ultralytics`
- 已确认 `.venv-yolo` 中 `ultralytics + torch` 可正常导入

接下来进入：

- Phase 2: 真模型接入与浏览器侧联调验证

当前 Phase 2 的重点很明确：

- 安装并验证前后端依赖
- 跑通本地测试和构建
- 在兼容 Python 环境中安装真实模型依赖
- 挂载真实 `YOLOv8-seg` 权重并完成单图验证
- 用真实模型结果完成 overlay 与导出联调
- 完成浏览器侧上传到结果展示的真实闭环验证
- 挂载真实权重文件并完成真实 runner 验证

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
- `phase2/` 已补充执行说明与开工清单

## Recommended Reading Order

如果是第一次进入项目，建议按下面的顺序读：

1. [plan/overall-goals.md](/Users/justin/Desktop/BDI/plan/overall-goals.md)
2. [plan/phase2.md](/Users/justin/Desktop/BDI/plan/phase2.md)
3. [for_crt/02-系统架构草案.md](/Users/justin/Desktop/BDI/for_crt/02-系统架构草案.md)
4. [for_crt/03-YOLOv8对接协议与兼容设计.md](/Users/justin/Desktop/BDI/for_crt/03-YOLOv8对接协议与兼容设计.md)
5. [AGENTS/00-entry/AGENTS.md](/Users/justin/Desktop/BDI/AGENTS/00-entry/AGENTS.md)

如果你是来直接开工实现，重点先看第 2、4、5 份文档。

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

下一步建议继续推进 Phase 2，把当前已验证的 mock 骨架升级成真实可联调版本：

- 安装前后端依赖并完成测试
- 接入真实 `YOLOv8-seg`
- 生成 overlay 图
- 验证前端可直接消费真实结果

推荐实际开发顺序：

1. 先安装并验证 `backend/` 和 `frontend/` 依赖
2. 先跑通测试，确认 mock 闭环稳定
3. 再把真实 `YOLOv8-seg` 接进 adapter 层
4. 最后补齐 overlay 与导出联调

## Notes

当前仓库仍然以文档驱动为主，但已经具备了前后端 MVP 骨架，并完成了 mock 路径的基础验证。

这意味着接下来的工作不再是“从零开始搭框架”，而是围绕统一协议，把 mock 闭环升级成真实模型闭环。

补充说明：

- 基础开发环境仍可使用当前 `Python 3.14`
- 真实 `ultralytics` 模型依赖建议在 `Python 3.9` 到 `Python 3.12` 的虚拟环境中安装
- 当前仓库不包含实际权重文件，未配置时后端会自动回退到 mock runner
- 当前尚未确认本机已安装 `ultralytics` 并挂载真实权重，因此 Phase 2 还不能按“真实模型闭环完成”计算
- 当前 `.venv-yolo` 已完成 `numpy<2` 调整，并已验证 `ultralytics + torch` 可导入
