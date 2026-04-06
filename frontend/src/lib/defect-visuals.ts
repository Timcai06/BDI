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
const CANONICAL_DEFECT_KEYS = new Set<DefectKey>([
  "crack",
  "breakage",
  "comb",
  "hole",
  "reinforcement",
  "seepage",
]);
const LABEL_TO_KEY: Record<string, DefectKey> = Object.entries(DEFECT_DICTIONARY).reduce(
  (accumulator, [key, value]) => {
    accumulator[value.label] = key as DefectKey;
    return accumulator;
  },
  {} as Record<string, DefectKey>,
);

export function normalizeCategory(category: string): DefectKey {
  const raw = category.trim();
  const value = raw.toLowerCase() as DefectKey;
  if (CANONICAL_DEFECT_KEYS.has(value)) {
    return value;
  }
  return LABEL_TO_KEY[raw] ?? "default";
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
