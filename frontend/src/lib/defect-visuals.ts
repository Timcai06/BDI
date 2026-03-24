export const DEFECT_DICTIONARY = {
  crack: {
    color: "#FF4D4D",
    label: "裂缝",
  },
  breakage: {
    color: "#F97316",
    label: "破损",
  },
  comb: {
    color: "#EAB308",
    label: "梳齿缺陷",
  },
  hole: {
    color: "#22C55E",
    label: "孔洞",
  },
  reinforcement: {
    color: "#00D2FF",
    label: "钢筋外露",
  },
  seepage: {
    color: "#A78BFA",
    label: "渗水",
  },
  default: {
    color: "#94A3B8",
    label: "未分类病害",
  },
} as const;

type DefectKey = keyof typeof DEFECT_DICTIONARY;

export function normalizeCategory(category: string): DefectKey {
  const value = category.trim().toLowerCase();
  const standardCategories: DefectKey[] = [
    "crack",
    "breakage",
    "comb",
    "hole",
    "reinforcement",
    "seepage",
    "default",
  ];

  // Prefer canonical backend categories first.
  if (standardCategories.includes(value as DefectKey)) {
    return value as DefectKey;
  }

  if (value === "裂缝" || value.includes("crack")) {
    return "crack";
  }
  if (
    value === "破损" ||
    value.includes("breakage") ||
    value.includes("spalling") ||
    value.includes("剥落")
  ) {
    return "breakage";
  }
  if (value === "梳齿缺陷" || value.includes("comb") || value.includes("梳齿")) {
    return "comb";
  }
  if (value === "孔洞" || value.includes("hole") || value.includes("空洞")) {
    return "hole";
  }
  if (
    value === "钢筋外露" ||
    value.includes("reinforcement") ||
    value.includes("rebar") ||
    value.includes("corrosion") ||
    value.includes("锈蚀")
  ) {
    return "reinforcement";
  }
  if (
    value === "渗水" ||
    value.includes("seepage") ||
    value.includes("efflorescence") ||
    value.includes("白华") ||
    value.includes("泛碱")
  ) {
    return "seepage";
  }

  return "default";
}

export function getDefectColorHex(category: string): string {
  return DEFECT_DICTIONARY[normalizeCategory(category)].color;
}

export function getDefectLabel(category: string): string {
  return DEFECT_DICTIONARY[normalizeCategory(category)].label;
}

export function getCanonicalCategoryOptions(): string[] {
  return Object.entries(DEFECT_DICTIONARY)
    .filter(([key]) => key !== "default")
    .map(([, value]) => value.label);
}
