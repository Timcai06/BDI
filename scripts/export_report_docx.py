#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "报告" / "全栈系统报告.md"
DEFAULT_OUTPUT = ROOT / "output" / "doc" / "全栈系统报告.docx"
MERMAID_CLI = "@mermaid-js/mermaid-cli@11.12.0"

PAGEBREAK_LUA = r'''
local pagebreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

function RawBlock(el)
  if el.format:match('html') then
    if el.text:match('page%-break%-after') or el.text:match('page%-break%-before') then
      return pandoc.RawBlock('openxml', pagebreak)
    end
    if el.text:match('^%s*</?div') then
      return {}
    end
  end
end
'''


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Missing required binary: {name}")
    return path


def run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def strip_manual_toc(markdown: str) -> str:
    pattern = re.compile(
        r"(?ms)^# 目录\s*\n.*?(?:<div style=\"page-break-after: always;\"></div>\s*)?(?=^#\s+)"
    )
    return pattern.sub("", markdown, count=1)


def write_mermaid_config(path: Path) -> None:
    config = {
        "theme": "neutral",
        "themeVariables": {
            "fontFamily": "PingFang SC, Microsoft YaHei, Arial, sans-serif",
        },
        "flowchart": {
            "curve": "linear",
            "htmlLabels": True,
            "useMaxWidth": True,
        },
        "sequence": {
            "useMaxWidth": True,
        },
        "er": {
            "useMaxWidth": True,
        },
    }
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def preprocess_for_docx(rendered_path: Path) -> None:
    text = rendered_path.read_text(encoding="utf-8")
    text = strip_manual_toc(text)
    text = text.replace("✅", "完成")
    text = text.replace("≥", ">=")
    text = text.replace("≤", "<=")
    rendered_path.write_text(text, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert the full-stack Markdown report to DOCX with Mermaid rendered as PNG."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Markdown source file")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="DOCX output file")
    parser.add_argument(
        "--title",
        default="BDI-Infra-Scan 桥梁病害智能判读系统全栈开发报告",
        help="Pandoc document title metadata",
    )
    parser.add_argument(
        "--toc-depth",
        default="3",
        help="Pandoc TOC depth. Use 2 or 3 for Word documents.",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep intermediate Markdown and Mermaid image assets under tmp/docs.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()

    if not source.exists():
        raise SystemExit(f"Report source not found: {source}")

    require_binary("pandoc")
    require_binary("npx")

    output.parent.mkdir(parents=True, exist_ok=True)
    temp_root = ROOT / "tmp" / "docs"
    temp_root.mkdir(parents=True, exist_ok=True)

    tmpdir = Path(tempfile.mkdtemp(prefix="docx-report-", dir=temp_root))
    cleanup_temp = not args.keep_temp
    try:
        rendered_md = tmpdir / "rendered.md"
        artefacts_dir = tmpdir / "mermaid"
        mermaid_config = tmpdir / "mermaid-config.json"
        pagebreak_filter = tmpdir / "pagebreak.lua"

        write_mermaid_config(mermaid_config)
        pagebreak_filter.write_text(PAGEBREAK_LUA, encoding="utf-8")

        run(
            [
                "npx",
                "-y",
                MERMAID_CLI,
                "-i",
                str(source),
                "-o",
                str(rendered_md),
                "-a",
                str(artefacts_dir),
                "-e",
                "png",
                "-t",
                "neutral",
                "-b",
                "white",
                "-w",
                "1280",
                "-H",
                "720",
                "-s",
                "1",
                "-c",
                str(mermaid_config),
                "-q",
            ],
            cwd=ROOT,
        )

        preprocess_for_docx(rendered_md)

        run(
            [
                "pandoc",
                str(rendered_md),
                "--from",
                "markdown+raw_html+pipe_tables+fenced_code_blocks+header_attributes+task_lists",
                "--standalone",
                "--toc",
                "--toc-depth",
                str(args.toc_depth),
                "--metadata",
                f"title={args.title}",
                "--metadata",
                "toc-title=目录",
                "--lua-filter",
                str(pagebreak_filter),
                "--resource-path",
                f"{tmpdir}:{ROOT}:{source.parent}",
                "-o",
                str(output),
            ],
            cwd=ROOT,
        )

        print(output)
        if args.keep_temp:
            print(tmpdir)
    finally:
        if cleanup_temp:
            shutil.rmtree(tmpdir, ignore_errors=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
