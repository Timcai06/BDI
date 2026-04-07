from __future__ import annotations

import pytest

from app.core.category_mapper import normalize_defect_category


class TestNormalizeDefectCategory:
    """Tests for normalize_defect_category with complexity 27."""

    def test_empty_string_returns_unknown(self):
        assert normalize_defect_category("") == "unknown"

    def test_whitespace_only_returns_unknown(self):
        assert normalize_defect_category("   ") == "unknown"

    def test_crack_english_variants(self):
        assert normalize_defect_category("crack") == "crack"
        assert normalize_defect_category("Crack") == "crack"
        assert normalize_defect_category("cracked surface") == "crack"
        assert normalize_defect_category("hairline crack") == "crack"

    def test_crack_chinese(self):
        assert normalize_defect_category("裂缝") == "crack"
        assert normalize_defect_category("细微裂缝") == "crack"

    def test_breakage_variants(self):
        assert normalize_defect_category("breakage") == "breakage"
        assert normalize_defect_category("破损") == "breakage"
        assert normalize_defect_category("spalling") == "breakage"
        assert normalize_defect_category("剥落") == "breakage"
        assert normalize_defect_category("剥蚀") == "breakage"

    def test_comb_variants(self):
        assert normalize_defect_category("comb") == "comb"
        assert normalize_defect_category("梳齿") == "comb"
        assert normalize_defect_category("伸缩缝") == "comb"

    def test_hole_variants(self):
        assert normalize_defect_category("hole") == "hole"
        assert normalize_defect_category("孔洞") == "hole"
        assert normalize_defect_category("空洞") == "hole"

    def test_reinforcement_variants(self):
        assert normalize_defect_category("reinforcement") == "reinforcement"
        assert normalize_defect_category("钢筋外露") == "reinforcement"
        assert normalize_defect_category("rebar") == "reinforcement"
        assert normalize_defect_category("corrosion") == "reinforcement"
        assert normalize_defect_category("rust") == "reinforcement"
        assert normalize_defect_category("锈蚀") == "reinforcement"

    def test_seepage_variants(self):
        assert normalize_defect_category("seepage") == "seepage"
        assert normalize_defect_category("渗水") == "seepage"
        assert normalize_defect_category("efflorescence") == "seepage"
        assert normalize_defect_category("leakage") == "seepage"
        assert normalize_defect_category("泛碱") == "seepage"
        assert normalize_defect_category("白华") == "seepage"

    def test_case_insensitive(self):
        assert normalize_defect_category("CRACK") == "crack"
        assert normalize_defect_category("Spalling") == "breakage"
        assert normalize_defect_category("SEEPAGE") == "seepage"

    def test_whitespace_stripped(self):
        assert normalize_defect_category("  crack  ") == "crack"
        assert normalize_defect_category("\t破损\t") == "breakage"

    def test_unknown_category_returns_as_is(self):
        assert normalize_defect_category("unknown_type") == "unknown"
        assert normalize_defect_category("风化") == "unknown"

    def test_priority_order(self):
        # "crack" should match before "spalling" if both substrings present
        # (first match wins in the if-chain)
        assert normalize_defect_category("crack with spalling") == "crack"

    def test_long_description(self):
        assert normalize_defect_category("表面存在多处纵向裂缝，长度约20cm") == "crack"
        assert normalize_defect_category("混凝土剥落，钢筋外露并锈蚀") == "breakage"
