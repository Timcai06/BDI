# BDI

桥梁病害识别系统原型项目。

这个仓库当前还不是代码仓，更准确地说，它是这个项目的“起步控制台”。

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

当前仓库主要存放三类内容：

- 项目目标、架构和协议文档
- 分阶段开发计划
- 为后续工程实现准备的项目入口说明

目前还没有正式展开 `backend/`、`frontend/` 和模型接入代码，所以它处在“Phase 1 已收敛，Phase 2 即将开始”的状态。

## Current Status

已经完成：

- 项目方向和比赛导向收敛
- 产品目标与需求文档整理
- 系统架构与模型兼容策略设计
- Phase 1 规划内容基本完成

接下来进入：

- Phase 2: MVP 系统骨架搭建

Phase 2 的重点很明确：

- 搭建 `FastAPI` 后端骨架
- 搭建前端基础框架
- 建立统一推理接口与结果协议
- 跑通单张图上传与推理闭环

## Repository Structure

```text
.
├── AGENTS/      # 面向智能体/执行者的项目知识文档
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

下一步建议直接开始 Phase 2，先落最小工程骨架：

- `backend/`
- `frontend/`
- 统一结果 schema
- `POST /predict`
- `GET /health`

推荐实际开发顺序：

1. 先搭 `FastAPI` 后端目录和数据模型
2. 先把统一结果协议落成可返回的 mock 接口
3. 再搭前端上传页和结果页骨架
4. 最后把真实 `YOLOv8-seg` 接进 adapter 层

## Notes

当前仓库仍以文档和规划为主，代码骨架尚未正式展开。

这不是坏事。相反，这意味着项目目标、边界和推进顺序已经比较清楚，接下来适合直接进入实现阶段。
