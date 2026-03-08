# PROGRESS

## 当前状态

- 已完成项目方向判断
- 已完成系统结构思路
- 已完成 YOLOv8 对接与兼容设计初稿
- 已完成项目核心目标文档
- 已建立 AGENTS 文档文件夹
- 已建立 `backend/` FastAPI MVP 骨架
- 已建立 `frontend/` Next.js MVP 骨架
- 已实现 `GET /health` 与 `POST /predict` mock 闭环
- 已补充 `plan/phase2/` 执行说明与开工清单
- 已完成后端 `pytest` 7/7 与 `ruff check .` 校验
- 已完成前端 `test / lint / build` 校验
- 已为后端补充真实 `YOLOv8-seg` runner 接入位
- 已支持 overlay 文件保存与可选真实依赖安装
- 已完成后端 `GET /health` 启动检查，当前活跃 runner 为 `mock-runner`
- 已确认前端按统一 schema 消费 mock 结果，无需读取模型原始输出
- 已修复后端对 `Python 3.9` 的类型语法兼容问题
- 已确认 `.venv-yolo` 中安装了 `ultralytics`
- 已将 `.venv-yolo` 中的 `numpy` 调整为 `<2`，并确认 `ultralytics + torch` 可导入

## 当前重点

- 挂载真实 `YOLOv8-seg` 权重并完成单图验证
- 用真实结果补齐 overlay 与导出联调
- 完成浏览器侧上传到结果展示的端到端联调
- 验证真实 runner 返回结果无需前端协议改动
- 获取并挂载真实权重文件

## 下一步

- 在 `Python 3.9-3.12` 环境重装真实模型依赖并完成真实模型联调
- 完成浏览器侧上传到结果展示的真实推理验证
- 回写真实接入过程中的兼容问题与经验
- 将 `Phase 2` 文档状态与真实联调结果保持同步
