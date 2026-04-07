from __future__ import annotations

from typing import Final

CANONICAL_DEFECT_CATEGORIES: Final[tuple[str, ...]] = (
    "crack",
    "breakage",
    "comb",
    "hole",
    "reinforcement",
    "seepage",
)

_CATEGORY_ALIASES: Final[dict[str, tuple[str, ...]]] = {
    "crack": ("crack", "裂缝"),
    "breakage": ("breakage", "破损", "spalling", "剥落", "剥蚀"),
    "comb": ("comb", "梳齿", "伸缩缝"),
    "hole": ("hole", "孔洞", "空洞"),
    "reinforcement": ("reinforcement", "钢筋外露", "rebar", "corrosion", "rust", "锈蚀"),
    "seepage": ("seepage", "渗水", "efflorescence", "leakage", "泛碱", "白华"),
}

def normalize_defect_category(category: str) -> str:
    value = category.strip().lower()

    if not value:
        return "unknown"

    if value in CANONICAL_DEFECT_CATEGORIES:
        return value

    for canonical, aliases in _CATEGORY_ALIASES.items():
        if any(alias in value for alias in aliases):
            return canonical

    return "unknown"
