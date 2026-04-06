import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { OpsWorkbenchNavigation } from "@/components/ops/ops-workbench-navigation";
import type { BatchV1, BridgeV1 } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const bridge = {
  id: "br_1",
  bridge_code: "BR-001",
  bridge_name: "北岸桥",
  status: "active",
  region: "HZ",
  active_batch_count: 2,
  abnormal_batch_count: 1,
  latest_batch_id: null,
  latest_batch_code: null,
  latest_inspection_at: null,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
} as BridgeV1;

const batch = {
  id: "bat_1",
  bridge_id: "br_1",
  batch_code: "BR-001-20260406-001",
  source_type: "drone_image_stream",
  status: "running",
  expected_item_count: 0,
  received_item_count: 0,
  enhancement_mode: "always",
  created_by: "ops-user",
  created_at: "2026-04-06T00:00:00Z",
  updated_at: "2026-04-06T00:00:00Z",
  sealed: false,
} as BatchV1;

describe("OpsWorkbenchNavigation", () => {
  it("keeps batch selection disabled until a bridge is selected", () => {
    render(
      <OpsWorkbenchNavigation
        batches={[batch]}
        bridges={[bridge]}
        deletingBatch={false}
        onDeleteCurrentBatch={() => {}}
        onOpenWizard={() => {}}
        onSelectBatch={() => {}}
        onSelectBridge={() => {}}
        selectedBatch={null}
        selectedBatchId=""
        selectedBridge={null}
        selectedBridgeId=""
      />,
    );

    const selects = screen.getAllByRole("combobox");
    expect(selects[1]).toBeDisabled();
  });

  it("emits bridge and batch changes and exposes actions", () => {
    const onSelectBridge = vi.fn();
    const onSelectBatch = vi.fn();
    const onOpenWizard = vi.fn();
    const onDeleteCurrentBatch = vi.fn();

    render(
      <OpsWorkbenchNavigation
        batches={[batch]}
        bridges={[bridge]}
        deletingBatch={false}
        onDeleteCurrentBatch={onDeleteCurrentBatch}
        onOpenWizard={onOpenWizard}
        onSelectBatch={onSelectBatch}
        onSelectBridge={onSelectBridge}
        selectedBatch={batch}
        selectedBatchId={batch.id}
        selectedBridge={bridge}
        selectedBridgeId={bridge.id}
      />,
    );

    const [bridgeSelect, batchSelect] = screen.getAllByRole("combobox");
    fireEvent.change(bridgeSelect, { target: { value: bridge.id } });
    fireEvent.change(batchSelect, { target: { value: batch.id } });
    fireEvent.click(screen.getByTitle("新建批次"));
    fireEvent.click(screen.getByTitle("删除当前批次"));

    expect(onSelectBridge).toHaveBeenCalledWith(bridge.id);
    expect(onSelectBatch).toHaveBeenCalledWith(batch.id);
    expect(onOpenWizard).toHaveBeenCalledTimes(1);
    expect(onDeleteCurrentBatch).toHaveBeenCalledTimes(1);
  });
});
