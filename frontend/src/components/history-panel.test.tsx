import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { HistoryPanel } from "@/components/history-panel";

describe("HistoryPanel", () => {
  it("renders history items and lets the user select one", () => {
    const onSelect = vi.fn();

    render(
      <HistoryPanel
        items={[
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
          }
        ]}
        loading={false}
        errorMessage={null}
        deletingImageId={null}
        deleteSuccessMessage={null}
        filterMode="recent"
        searchQuery=""
        categoryFilter="全部"
        sortMode="newest"
        availableCategories={["裂缝"]}
        onRefresh={() => {}}
        onDeleteRequest={() => {}}
        onFilterChange={() => {}}
        onSearchQueryChange={() => {}}
        onCategoryFilterChange={() => {}}
        onSortModeChange={() => {}}
        onOpenUploader={() => {}}
        onSelect={onSelect}
        getImageUrl={() => null}
      />
    );

    fireEvent.click(screen.getByRole("article"));

    expect(onSelect).toHaveBeenCalledWith("bridge-001.jpg");
  });

  it("triggers delete request for the selected item", () => {
    const onDeleteRequest = vi.fn();

    render(
      <HistoryPanel
        items={[
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
          }
        ]}
        loading={false}
        errorMessage={null}
        deletingImageId={null}
        deleteSuccessMessage={null}
        filterMode="recent"
        searchQuery=""
        categoryFilter="全部"
        sortMode="newest"
        availableCategories={["裂缝"]}
        onRefresh={() => {}}
        onDeleteRequest={onDeleteRequest}
        onFilterChange={() => {}}
        onSearchQueryChange={() => {}}
        onCategoryFilterChange={() => {}}
        onSortModeChange={() => {}}
        onOpenUploader={() => {}}
        onSelect={() => {}}
        getImageUrl={() => null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(onDeleteRequest).toHaveBeenCalledWith("bridge-001.jpg");
  });

  it("switches filter mode when the user clicks a filter chip", () => {
    const onFilterChange = vi.fn();

    render(
      <HistoryPanel
        items={[
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
          }
        ]}
        loading={false}
        errorMessage={null}
        deletingImageId={null}
        deleteSuccessMessage={null}
        filterMode="recent"
        searchQuery=""
        categoryFilter="全部"
        sortMode="newest"
        availableCategories={["裂缝"]}
        onRefresh={() => {}}
        onDeleteRequest={() => {}}
        onFilterChange={onFilterChange}
        onSearchQueryChange={() => {}}
        onCategoryFilterChange={() => {}}
        onSortModeChange={() => {}}
        onOpenUploader={() => {}}
        onSelect={() => {}}
        getImageUrl={() => null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "全部" }));

    expect(onFilterChange).toHaveBeenCalledWith("all");
  });

  it("updates search and category filters", () => {
    const onSearchQueryChange = vi.fn();
    const onCategoryFilterChange = vi.fn();

    render(
      <HistoryPanel
        items={[
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
          }
        ]}
        loading={false}
        errorMessage={null}
        deletingImageId={null}
        deleteSuccessMessage={null}
        filterMode="all"
        searchQuery=""
        categoryFilter="全部"
        sortMode="newest"
        availableCategories={["裂缝"]}
        onRefresh={() => {}}
        onDeleteRequest={() => {}}
        onFilterChange={() => {}}
        onSearchQueryChange={onSearchQueryChange}
        onCategoryFilterChange={onCategoryFilterChange}
        onSortModeChange={() => {}}
        onOpenUploader={() => {}}
        onSelect={() => {}}
        getImageUrl={() => null}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("搜索图片名、模型版本或后端类型"),
      { target: { value: "bridge" } }
    );
    fireEvent.change(screen.getByDisplayValue("全部病害"), {
      target: { value: "裂缝" }
    });

    expect(onSearchQueryChange).toHaveBeenCalledWith("bridge");
    expect(onCategoryFilterChange).toHaveBeenCalledWith("裂缝");
  });

  it("updates the sort mode", () => {
    const onSortModeChange = vi.fn();

    render(
      <HistoryPanel
        items={[
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
          }
        ]}
        loading={false}
        errorMessage={null}
        deletingImageId={null}
        deleteSuccessMessage={null}
        filterMode="all"
        searchQuery=""
        categoryFilter="全部"
        sortMode="newest"
        availableCategories={["裂缝"]}
        onRefresh={() => {}}
        onDeleteRequest={() => {}}
        onFilterChange={() => {}}
        onSearchQueryChange={() => {}}
        onCategoryFilterChange={() => {}}
        onSortModeChange={onSortModeChange}
        onOpenUploader={() => {}}
        onSelect={() => {}}
        getImageUrl={() => null}
      />
    );

    fireEvent.change(screen.getByDisplayValue("最新优先"), {
      target: { value: "fastest" }
    });

    expect(onSortModeChange).toHaveBeenCalledWith("fastest");
  });
});
