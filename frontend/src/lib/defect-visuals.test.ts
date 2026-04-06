import { getDefectColorHex, getDefectLabel, normalizeCategory } from "@/lib/defect-visuals";

describe("defect-visuals contract", () => {
  it("normalizes canonical backend categories", () => {
    expect(normalizeCategory("crack")).toBe("crack");
    expect(normalizeCategory("breakage")).toBe("breakage");
    expect(normalizeCategory("reinforcement")).toBe("reinforcement");
    expect(normalizeCategory("seepage")).toBe("seepage");
  });

  it("maps known backend synonyms to stable display keys", () => {
    expect(normalizeCategory("spalling")).toBe("breakage");
    expect(normalizeCategory("剥落")).toBe("breakage");
    expect(normalizeCategory("rebar")).toBe("reinforcement");
    expect(normalizeCategory("corrosion")).toBe("reinforcement");
    expect(normalizeCategory("efflorescence")).toBe("seepage");
    expect(normalizeCategory("白华")).toBe("seepage");
  });

  it("returns stable labels and colors for aliases", () => {
    expect(getDefectLabel("spalling")).toBe("破损");
    expect(getDefectLabel("rebar")).toBe("钢筋外露");
    expect(getDefectLabel("efflorescence")).toBe("渗水");
    expect(getDefectColorHex("白华")).toBe(getDefectColorHex("seepage"));
  });

  it("falls back to default for unknown categories", () => {
    expect(normalizeCategory("weathering")).toBe("default");
    expect(getDefectLabel("weathering")).toBe("未分类病害");
  });
});
