#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path("/Users/tim/BDI")
REPORT_MD = ROOT / "报告" / "全栈系统报告.md"
REPORT_PDF = ROOT / "报告" / "全栈系统报告.pdf"
PRINT_CSS = ROOT / "scripts" / "report-print.css"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    shutil.which("google-chrome"),
    shutil.which("chromium"),
    shutil.which("chromium-browser"),
]


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Missing required binary: {name}")
    return path


def require_chrome() -> str:
    for candidate in CHROME_CANDIDATES:
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("Missing Chrome/Chromium executable for PDF export")


def run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def main() -> int:
    if not REPORT_MD.exists():
        raise SystemExit(f"Report source not found: {REPORT_MD}")
    if not PRINT_CSS.exists():
        raise SystemExit(f"Print CSS not found: {PRINT_CSS}")

    require_binary("pandoc")
    require_binary("npx")
    chrome = require_chrome()

    with tempfile.TemporaryDirectory(prefix="bdi-report-") as tmp:
        tmpdir = Path(tmp)
        rendered_md = tmpdir / "rendered.md"
        html_path = tmpdir / "report.html"
        artefacts_dir = tmpdir / "assets"
        css_path = tmpdir / "report-print.css"

        shutil.copy2(PRINT_CSS, css_path)

        run(
            [
                "npx",
                "-y",
                "@mermaid-js/mermaid-cli",
                "-i",
                str(REPORT_MD),
                "-o",
                str(rendered_md),
                "-a",
                str(artefacts_dir),
                "-e",
                "svg",
                "-w",
                "640",
                "-H",
                "380",
                "-q",
            ],
            cwd=ROOT,
        )

        run(
            [
                "pandoc",
                str(rendered_md),
                "-s",
                "--toc",
                "--embed-resources",
                "--metadata",
                "title=BDI-Infra-Scan 桥梁病害智能判读系统 项目详细方案",
                "--css",
                css_path.name,
                "-o",
                str(html_path),
            ],
            cwd=tmpdir,
        )

        run(
            [
                chrome,
                "--headless",
                "--disable-gpu",
                f"--print-to-pdf={REPORT_PDF}",
                html_path.as_uri(),
            ],
            cwd=ROOT,
        )

    print(REPORT_PDF)
    return 0


if __name__ == "__main__":
    sys.exit(main())
