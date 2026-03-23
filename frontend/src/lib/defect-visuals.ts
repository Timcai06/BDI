const DEFECT_COLOR_MAP = {
  crack: "#FF4D4D",
  spalling: "#00D2FF",
  corrosion: "#00D2FF",
  efflorescence: "#A78BFA",
  default: "#94A3B8",
} as const;

function normalizeCategory(category: string): keyof typeof DEFECT_COLOR_MAP {
  const value = category.trim().toLowerCase();

  if (value.includes("crack") || value.includes("裂缝")) {
    return "crack";
  }
  if (value.includes("spalling") || value.includes("剥落")) {
    return "spalling";
  }
  if (
    value.includes("corrosion") ||
    value.includes("锈蚀") ||
    value.includes("腐蚀")
  ) {
    return "corrosion";
  }
  if (
    value.includes("efflo") ||
    value.includes("泛碱") ||
    value.includes("白华")
  ) {
    return "efflorescence";
  }

  return "default";
}

export function getDefectColorHex(category: string): string {
  return DEFECT_COLOR_MAP[normalizeCategory(category)];
}

export function getDefectColorClasses(category: string): string {
  switch (normalizeCategory(category)) {
    case "crack":
      return "border-[#FF4D4D] bg-[#FF4D4D]/10 text-[#FF4D4D]";
    case "spalling":
      return "border-[#00D2FF] bg-[#00D2FF]/10 text-[#00D2FF]";
    case "corrosion":
      return "border-[#00D2FF] bg-[#00D2FF]/10 text-[#00D2FF]";
    case "efflorescence":
      return "border-[#A78BFA] bg-[#A78BFA]/10 text-[#A78BFA]";
    default:
      return "border-slate-400 bg-slate-400/10 text-slate-400";
  }
}
