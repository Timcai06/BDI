# <img src="https://raw.githubusercontent.com/justin/BDI_clean_check/main/logo.svg" width="30" height="30" alt="logo"> **BDI‑Infra‑Scan** 🚀

![Build Status](https://img.shields.io/github/actions/workflow/status/justin/BDI_clean_check/ci.yml?branch=main&style=flat-square)
![License](https://img.shields.io/github/license/justin/BDI_clean_check?style=flat-square)
![Version](https://img.shields.io/npm/v/bdi?style=flat-square)
![Stars](https://img.shields.io/github/stars/justin/BDI_clean_check?style=social)

---

## 简介

**BDI‑Infra‑Scan** 是面向无人机桥梁巡检的 AI 病害识别原型系统，提供 **图像上传 → 病害检测 → 结果可视化 → 结构化导出 → 历史回看** 的完整闭环。

---

## 目录

- [快速开始](#快速开始)
- [主要特性](#主要特性)
- [演示](#演示)
- [使用说明](#使用说明)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [致谢](#致谢)

---

## 主要特性

- ⚡ **极速渲染**：基于 Next.js 16 + Webpack 5，首屏 < 1 s
- 🎨 **极客 UI**：玻璃态、渐变、微动画，打造高科技工作台
- 🤖 **AI 诊断**：集成 `YOLOv8‑seg`，自动识别桥梁裂缝、剥落等病害
- 📊 **多模型对比**：支持模型切换、置信度过滤、一键导出
- 📁 **历史回看**：上传记录持久化，支持批量导出 JSON 与叠加图

---

## 演示

![Demo GIF](https://raw.githubusercontent.com/justin/BDI_clean_check/main/docs/demo.gif)

> 体验完整流程：上传图片 → 实时检测 → 结果对比 → 导出

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/justin/BDI_clean_check.git
cd BDI_clean_check

# 安装依赖（使用 npm ci 确保锁文件一致）
npm ci

# 本地开发（默认 http://localhost:3000）
npm run dev
```

> **Tip**：若只想快速预览 UI，可运行 `bdi run mock`（后端 mock）

---

## 使用说明

### 启动命令

- `bdi run` – 同时启动前端 & 后端（真实模型）
- `bdi run mock` – 启动前端 + mock 后端，便于 UI 调试
- `bdi status` – 查看当前服务状态
- `bdi stop` – 停止所有运行中的服务

### 脚本快捷入口

```bash
./scripts/dev-frontend.sh   # 前端开发服务器
./scripts/dev-backend-mock.sh   # Mock 后端
./scripts/dev-backend-real.sh   # 真正推理后端
./scripts/dev-check.sh          # 环境检查脚本
```

---

## 技术架构

```mermaid
graph LR
    FE[前端 (Next.js)] --> BE[后端 (FastAPI)]
    BE --> Model[YOLOv8‑seg]
    Model --> BE
    BE --> DB[(PostgreSQL)]
    FE --> UI[React Components]
```

- **前端**：Next.js 16、TailwindCSS、React 18
- **后端**：FastAPI、Python 3.12、ultralytics YOLOv8‑seg
- **数据库**：PostgreSQL 用于历史记录与模型元数据

---

## 项目结构

```
.
├── AGENTS/          # 项目知识库、产品目标、架构约束
├── backend/         # FastAPI 后端实现 & 测试
├── frontend/        # Next.js 前端实现 & UI 组件
├── for_crt/         # 项目方针、分析文档
├── plan/            # 阶段性开发计划
├── scripts/         # 开发/部署脚本
└── README.md        # 本文件
```

---

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 `git checkout -b feat/your-feature`
3. 编写代码并通过 **ESLint、Prettier、TypeScript** 检查
4. 提交时遵循 **Conventional Commits**（`feat:`, `fix:` 等）
5. 发起 Pull Request，CI 将自动运行 lint、test、build

> **代码规范**：使用 `npm run lint`、`npm run format` 保持统一风格。

---

## 许可证

本项目采用 **MIT License**，详见 `LICENSE` 文件。

---

## 致谢

- **ultralytics** 提供的 YOLOv8‑seg 模型
- **Next.js** 与 **FastAPI** 社区的开源贡献
- 项目所有贡献者与使用者的宝贵反馈

---

*本 README 采用 **GitHub Flavored Markdown**，在 GitHub 页面可直接渲染。*
