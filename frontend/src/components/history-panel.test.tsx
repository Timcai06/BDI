import { HistoryPanel as CanonicalHistoryPanel } from "@/components/history";
import { HistoryPanel as CompatibilityHistoryPanel } from "@/components/history-panel";

describe("history-panel compatibility export", () => {
  it("re-exports the canonical HistoryPanel implementation", () => {
    expect(CompatibilityHistoryPanel).toBe(CanonicalHistoryPanel);
  });
});
