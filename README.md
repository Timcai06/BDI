# BDI

桥梁病害识别系统原型项目。

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
- 已落地的 `backend/` MVP 骨架
- 已落地的 `frontend/` MVP 骨架

当前处在“Phase 2 已完成、Phase 3 已进入实施并已完成大部分核心能力”的状态。

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

当前仍处于：

- Phase 3: 结果展示增强与系统稳定化

按当前代码实现，Phase 3 已完成或已具备：

- 更完整的结果页展示与说明表达
- overlay / JSON 导出入口
- 错误态、空态和失败反馈基础能力
- 本地历史结果基础回看能力
- 结果列表 / 详情 / 原图 / overlay / 删除接口

当前 Phase 3 剩余重点主要是：

- 继续打磨结果页表达与交互细节
- 继续提升演示稳定性与异常处理体验
- 补全文档回写，确保计划与实现一致

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
2. [plan/overall-goals.md](/Users/justin/Desktop/BDI/plan/overall-goals.md)
3. [plan/phase3.md](/Users/justin/Desktop/BDI/plan/phase3.md)
4. [for_crt/02-系统架构草案.md](/Users/justin/Desktop/BDI/for_crt/02-系统架构草案.md)
5. [for_crt/03-YOLOv8对接协议与兼容设计.md](/Users/justin/Desktop/BDI/for_crt/03-YOLOv8对接协议与兼容设计.md)

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

下一步建议继续推进 Phase 3，把当前已跑通的单图闭环升级成更稳定的展示与回看版本：

- 完善结果页
- 增加导出交互
- 增加历史结果基础能力
- 强化错误态与演示稳定性

推荐实际开发顺序：

1. 先阅读 `AGENTS/` 与当前阶段计划文档
2. 再确认 `Phase 3` 的结果页与导出范围
3. 先补齐历史回看和错误态基础能力
4. 最后再推进更高阶展示和演示优化

## Notes

当前仓库仍然以文档驱动为主，但已经具备真实单图闭环能力，并已实际落地 Phase 3 的大部分展示增强能力。

这意味着接下来的工作不再是“从零开始搭框架”，而是围绕统一协议，把已跑通的真实链路提升成更完整的系统演示能力。

补充说明：

- 基础开发环境仍可使用当前 `Python 3.14`
- 真实 `ultralytics` 模型依赖建议在 `Python 3.9` 到 `Python 3.12` 的虚拟环境中安装
- 当前仓库不包含实际权重文件，未配置时后端会自动回退到 mock runner
- 当前 `.venv-yolo` 已完成 `numpy<2` 调整，并已验证 `ultralytics + torch` 可导入
- 所有开发任务开始前，应先参考 `AGENTS/` 目录确认约束与当前阶段，避免文档漂移
