import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { HistoryPanel } from "@/components/history";

const items = [
  {
    image_id: "bridge-001.jpg",
    created_at: "2026-03-09T10:00:00Z",
    model_name: "yolov8-seg",
    model_version: "v1-real",
    backend: "pytorch",
    inference_mode: "direct",
    inference_ms: 231,
    detection_count: 3,
    categories: ["裂缝"],
    artifacts: {
      upload_path: "uploads/bridge-001.jpg",
      json_path: "results/bridge-001.json",
      overlay_path: "overlays/bridge-001.png"
    }
  },
  {
    image_id: "bridge-002.jpg",
    created_at: "2026-03-09T11:00:00Z",
    model_name: "yolov8-seg",
    model_version: "v1-real",
    backend: "pytorch",
    inference_mode: "direct",
    inference_ms: 199,
    detection_count: 1,
    categories: ["裂缝"],
    artifacts: {
      upload_path: "uploads/bridge-002.jpg",
      json_path: "results/bridge-002.json",
      overlay_path: null
    }
  },
  {
    image_id: "pier-003.jpg",
    created_at: "2026-03-09T12:00:00Z",
    model_name: "yolov8-seg",
    model_version: "v1-real",
    backend: "pytorch",
    inference_mode: "direct",
    inference_ms: 188,
    detection_count: 2,
    categories: ["破损"],
    artifacts: {
      upload_path: "uploads/pier-003.jpg",
      json_path: "results/pier-003.json",
      overlay_path: "overlays/pier-003.png"
    }
  }
];

function renderHistoryPanel(overrides: Partial<ComponentProps<typeof HistoryPanel>> = {}) {
  return render(
    <HistoryPanel
      items={items}
      totalCount={items.length}
      loading={false}
      errorMessage={null}
      deletingImageId={null}
      deleteSuccessMessage={null}
      searchQuery=""
      categoryFilter="全部"
      sortMode="newest"
      availableCategories={["裂缝", "破损"]}
      onRefresh={() => {}}
      onSelect={() => {}}
      onDeleteRequest={() => {}}
      onBatchDelete={async () => {}}
      onBatchExportJson={async () => {}}
      onBatchExportOverlay={async () => {}}
      onSearchQueryChange={() => {}}
      onCategoryFilterChange={() => {}}
      onSortModeChange={() => {}}
      onOpenUploader={() => {}}
      getImageUrl={() => null}
      {...overrides}
    />
  );
}

describe("HistoryPanel batch mode", () => {
  it("selects all filtered results instead of only the current page subset", async () => {
    const onBatchDelete = vi.fn(async () => {});

    renderHistoryPanel({
      searchQuery: "bridge",
      onBatchDelete
    });

    fireEvent.click(screen.getByRole("button", { name: "批量" }));
    fireEvent.click(screen.getByRole("button", { name: "选择全部筛选结果 (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "批量删除已选记录" }));
    fireEvent.click(screen.getByRole("button", { name: "确认执行" }));

    await waitFor(() => {
      expect(onBatchDelete).toHaveBeenCalledWith(["bridge-002.jpg", "bridge-001.jpg"]);
    });
  });

  it("toggles selection instead of opening detail when clicking a card in batch mode", () => {
    const onSelect = vi.fn();

    renderHistoryPanel({
      onSelect
    });

    fireEvent.click(screen.getByRole("button", { name: "批量" }));
    fireEvent.click(screen.getByText("3 处病害"));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/已选择/i)).toHaveTextContent("已选择 1 项");
  });
});
