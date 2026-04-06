from __future__ import annotations


def normalize_defect_category(category: str) -> str:
    value = category.strip().lower()

    if not value:
        return "unknown"

    if "crack" in value or "裂缝" in value:
        return "crack"

    if "breakage" in value or "破损" in value or "spalling" in value or "剥落" in value or "剥蚀" in value:
        return "breakage"

    if "comb" in value or "梳齿" in value or "伸缩缝" in value:
        return "comb"

    if "hole" in value or "孔洞" in value or "空洞" in value:
        return "hole"

    if (
        "reinforcement" in value
        or "钢筋外露" in value
        or "rebar" in value
        or "corrosion" in value
        or "rust" in value
        or "锈蚀" in value
    ):
        return "reinforcement"

    if (
        "seepage" in value
        or "渗水" in value
        or "efflorescence" in value
        or "leakage" in value
        or "泛碱" in value
        or "白华" in value
    ):
        return "seepage"

    return value
