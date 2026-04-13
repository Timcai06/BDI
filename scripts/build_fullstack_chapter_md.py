#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "报告" / "全栈系统报告.md"
DEFAULT_OUTPUT = ROOT / "报告" / "第五章_软件系统全栈设计与实现.md"


COVER = """# 第 5 章 软件系统全栈设计与实现 {.unnumbered .unlisted}

## BDI-Infra-Scan 桥梁病害智能判读系统 {.unnumbered .unlisted}

---

<div style="text-align: center; margin-top: 100px;">

**章节定位**：完整项目报告第 5 章  
**负责内容**：项目全栈开发与系统落地  
**日期**：2026年4月  

</div>

---

<div style="page-break-after: always;"></div>

# 本章摘要 {.unnumbered .unlisted}

本章作为完整项目报告的第 5 章，聚焦本人负责的全栈软件系统开发工作。完整项目中的模型训练、算法创新、数据集建设与实验评估由其他章节展开；本章只在必要位置说明这些模型与算法能力如何被软件系统接入、调度、融合、落库和展示。

围绕无人机桥梁巡检场景，本章重点说明前端工作台、后端服务、数据库持久化、异步任务、多模型接入、增强结果管理、告警复核闭环与导出诊断能力。前端采用 **Next.js 16 + React 19 + TypeScript + TailwindCSS 4** 构建多页面业务工作台，后端采用 **FastAPI + Pydantic + SQLAlchemy + PostgreSQL** 组织接口、任务、结果和运维域数据。

本章的写作边界是“软件系统如何支撑完整项目落地”：既不重复完整报告前几章的项目背景，也不替代模型与算法章节的创新论证，而是从工程实现角度交代完整业务链路、关键模块职责和可复现材料。

**关键词**：全栈开发、桥梁病害检测系统、Next.js、FastAPI、PostgreSQL、异步任务、多模型接入、运维闭环

---

<div style="page-break-after: always;"></div>

# 目录

第 5 章 软件系统全栈设计与实现  
5.1 软件体系结构  
5.2 软件接口规范  
5.3 前端设计  
5.4 后端设计  
5.5 基本功能  
5.6 核心功能实现  
5.7 本章小结  
附录 A API 接口文档  
附录 B 数据库设计  
附录 C 系统运行与本地复现说明  
附录 D Markdown、Mermaid 与 Word 导出链路  
附录 E 项目结构与关键目录说明  

<div style="page-break-after: always;"></div>
"""


DOCX_CHAIN = """# 附录 D：Markdown、Mermaid 与 Word 导出链路

## D.0 推荐 DOCX 导出链路

本章节稿不建议直接把 Markdown 交给 Word 或 Typora 导出，因为 Word 不认识 Mermaid 源码，直接转换会把图表变成代码块或丢失图形。推荐链路是：

1. 使用 Mermaid CLI 扫描 Markdown，把所有 `mermaid` 代码块渲染为 PNG 图片。
2. 使用 Pandoc 读取已替换图片链接的 Markdown，并生成 `.docx`。
3. 使用 Pandoc Lua filter 把 HTML 分页标记转换为 Word 原生分页符。
4. 解包 `.docx` 或用 Word/LibreOffice 检查 `word/media`，确认 Mermaid 图已经作为图片嵌入。

本仓库已提供脚本：

```bash
python3 scripts/export_report_docx.py --input 报告/第五章_软件系统全栈设计与实现.md --output output/doc/第五章_软件系统全栈设计与实现.docx
```

该脚本的核心处理顺序是：

```text
Markdown 源文件
  -> npx @mermaid-js/mermaid-cli 渲染 Mermaid 为 PNG
  -> 临时 rendered.md 替换 Mermaid 为图片引用
  -> pandoc + pagebreak.lua 生成 Word 文档
  -> output/doc/*.docx
```

对本章而言，标准 Markdown 表格由 Pandoc 原生转换为 Word 表格；Mermaid 图由脚本统一转成 PNG 后嵌入 Word，因此不会依赖 Word 原生理解 Mermaid。

"""


def extract_between(text: str, start_marker: str, end_marker: str | None = None) -> str:
    try:
        start = text.index(start_marker)
    except ValueError as exc:
        raise SystemExit(f"Start marker not found: {start_marker}") from exc

    if end_marker is None:
        return text[start:].strip()

    try:
        end = text.index(end_marker, start + len(start_marker))
    except ValueError as exc:
        raise SystemExit(f"End marker not found: {end_marker}") from exc

    return text[start:end].strip()


def normalize_chapter_body(body: str) -> str:
    body = body.replace("# 5 软件设计与实现", "# 5 软件系统全栈设计与实现", 1)
    body = body.replace(
        """```mermaid
flowchart LR
    A["创建桥梁资产"] --> B["创建巡检批次"]
    B --> C["批量上传图片"]
    C --> D["创建 BatchItem / Task"]
    D --> E["异步推理执行"]
    E --> F["结果入库与媒体产物保存"]
    F --> G["详情查看 / 历史归档"]
    G --> H["人工复核"]
    H --> I["告警触发与处理"]
    I --> J["闭环记录"]
```""",
        """```mermaid
sequenceDiagram
    participant U as 前端工作台
    participant B as 后端服务
    participant M as 模型引擎
    participant D as 数据库与文件产物
    U->>B: 创建桥梁资产与巡检批次
    U->>B: 批量上传图片
    B->>D: 创建 BatchItem / Task
    B->>M: 异步推理执行
    M-->>B: 返回检测结果
    B->>D: 结果入库并保存媒体产物
    U->>B: 查看详情与历史归档
    U->>B: 人工复核与告警处理
    B->>D: 写入闭环记录
```""",
    )
    body = body.replace(
        """```mermaid
flowchart LR
    A["原始记录"] --> B["增强处理"]
    B --> C["增强图生成"]
    C --> D["增强图再识别"]
    D --> E["secondary_result 入库"]
    E --> F["详情页切换查看"]
```""",
        """```mermaid
sequenceDiagram
    participant U as 结果详情页
    participant B as 后端服务
    participant E as 增强运行时
    participant M as 模型引擎
    participant D as 结果存储
    U->>B: 触发增强补算
    B->>E: 生成增强图
    E-->>B: 返回增强图产物
    B->>M: 对增强图再识别
    M-->>B: 返回增强检测结果
    B->>D: 写入 secondary_result
    U->>B: 切换查看增强结果
```""",
    )
    body = body.replace(
        """```mermaid
flowchart TD
    A["批量上传图片"] --> B["创建 BatchItem"]
    B --> C["创建 InferenceTask"]
    C --> D["Task 状态: queued"]
    D --> E["Worker 处理任务"]
    E --> F["生成 Result / Detection"]
    F --> G["更新 Batch 统计"]
    G --> H["前端查看工作台与详情"]
```""",
        """```mermaid
sequenceDiagram
    participant U as 前端工作台
    participant B as 批次服务
    participant T as 任务服务
    participant W as Worker
    participant D as 数据库
    U->>B: 批量上传图片
    B->>D: 创建 BatchItem
    B->>T: 创建 InferenceTask queued
    W->>T: 领取任务并执行
    W->>D: 写入 Result / Detection
    T->>D: 更新 Batch 统计
    U->>B: 轮询状态并打开详情
```""",
    )
    return body


def normalize_appendices(appendices: str) -> str:
    marker = "# 附录 D：Typora 与 Mermaid 导出建议"
    if marker not in appendices:
        return appendices
    before, after = appendices.split(marker, 1)
    return before + DOCX_CHAIN + after.lstrip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a chapter-scoped Markdown file for the full-stack section."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Original report source")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Chapter Markdown output")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = args.source.resolve()
    output = args.output.resolve()

    if not source.exists():
        raise SystemExit(f"Report source not found: {source}")

    text = source.read_text(encoding="utf-8")
    chapter = extract_between(text, "# 5 软件设计与实现", "# 6 项目管理")
    appendices = extract_between(text, "# 附录 A：API 接口文档")

    document = "\n\n".join(
        [
            COVER.rstrip(),
            normalize_chapter_body(chapter),
            normalize_appendices(appendices),
        ]
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document.rstrip() + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
