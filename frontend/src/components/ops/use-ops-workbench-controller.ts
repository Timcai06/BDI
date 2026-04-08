"use client";

import { useRouter } from "next/navigation";

import { useOpsWorkbenchActions } from "./use-ops-workbench-actions";
import { useOpsWorkbenchState } from "./use-ops-workbench-state";

const CREATED_BY = "ops-user";
const SOURCE_DEVICE = "drone-A";
const MODEL_POLICY = "fusion-default";

export function useOpsWorkbenchController() {
  const router = useRouter();
  const state = useOpsWorkbenchState();
  const actions = useOpsWorkbenchActions({
    batches: state.batches,
    createdBy: CREATED_BY,
    currentEnhancementMode: state.currentEnhancementMode,
    items: state.items,
    modelPolicy: MODEL_POLICY,
    selectedBatch: state.selectedBatch,
    selectedBatchId: state.selectedBatchId,
    selectedItemIds: state.selectedItemIds,
    setActionLoading: state.setActionLoading,
    setBatchItemOffset: state.setBatchItemOffset,
    setBatchOffset: state.setBatchOffset,
    setCurrentEnhancementMode: state.setCurrentEnhancementMode,
    setDeletingBatch: state.setDeletingBatch,
    setError: state.setError,
    setIsWizardOpen: state.setIsWizardOpen,
    setNotice: state.setNotice,
    setRecentPathPrefixes: state.setRecentPathPrefixes,
    setRefreshTick: state.setRefreshTick,
    setRetryingTaskId: state.setRetryingTaskId,
    setSelectedBatchId: state.setSelectedBatchId,
    setSelectedBridgeId: state.setSelectedBridgeId,
    setSelectedItemIds: state.setSelectedItemIds,
    sourceDevice: SOURCE_DEVICE,
    visibleItems: state.visibleItems
  });

  return {
    isWizardOpen: state.isWizardOpen,
    mainProps: {
      batchItemLimit: state.batchItemLimit,
      batchItemOffset: state.batchItemOffset,
      batchItemTotal: state.batchItemTotal,
      batchTotal: state.batchTotal,
      createdBy: CREATED_BY,
      detections: state.detections,
      error: state.error,
      items: state.visibleItems,
      lastRefreshedAt: state.lastRefreshedAt,
      loading: state.loading,
      minConfidence: state.minConfidence,
      modelPolicy: MODEL_POLICY,
      notice: state.notice,
      onBatchItemPageChange: state.setBatchItemOffset,
      onClearSelection: () => state.setSelectedItemIds([]),
      onCreateClick: () => state.setIsWizardOpen(true),
      onMinConfidenceChange: state.setMinConfidence,
      onOpenBridgeAssets: () => router.push("/dashboard/bridges"),
      onPathFilterChange: state.setRelativePathPrefix,
      onRetrySelectedFailed: actions.handleRetrySelectedFailed,
      onRetryTask: actions.handleRetryBatchItemTask,
      onSelectVisibleItems: actions.handleSelectVisibleItems,
      onShowFailedOnlyToggle: () => state.setShowFailedItemsOnly(!state.showFailedItemsOnly),
      onToggleSelectItem: actions.handleToggleSelectItem,
      onToggleSummaryExpanded: () => state.setSummaryExpanded(!state.summaryExpanded),
      pathFilter: state.relativePathPrefix,
      retryingTaskId: state.retryingTaskId,
      selectedBatch: state.selectedBatch,
      selectedBatchId: state.selectedBatchId,
      selectedBridge: state.selectedBridge,
      selectedBridgeId: state.selectedBridgeId,
      selectedItemIds: state.selectedItemIds,
      showFailedItemsOnly: state.showFailedItemsOnly,
      sourceDevice: SOURCE_DEVICE,
      stats: state.stats,
      summaryExpanded: state.summaryExpanded
    },
    navigationProps: {
      batches: state.batches,
      bridges: state.bridges,
      deletingBatch: state.deletingBatch,
      onDeleteCurrentBatch: actions.handleDeleteCurrentBatch,
      onOpenWizard: () => state.setIsWizardOpen(true),
      onSelectBatch: state.setSelectedBatchId,
      onSelectBridge: state.setSelectedBridgeId,
      selectedBatch: state.selectedBatch,
      selectedBatchId: state.selectedBatchId,
      selectedBridge: state.selectedBridge,
      selectedBridgeId: state.selectedBridgeId
    },
    wizardProps: {
      isLoading: state.actionLoading,
      isOpen: state.isWizardOpen,
      onClose: () => state.setIsWizardOpen(false),
      onFinish: actions.handleWizardFinish,
      selectedBridge: state.selectedBridge
    }
  };
}
