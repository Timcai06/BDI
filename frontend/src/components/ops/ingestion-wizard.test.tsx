import { fireEvent, render, screen } from "@testing-library/react";

import { IngestionWizard } from "@/components/ops/ingestion-wizard";

describe("IngestionWizard", () => {
  it("prevents finishing step 2 without any files", async () => {
    const onFinish = vi.fn();

    render(
      <IngestionWizard
        isOpen
        onClose={vi.fn()}
        onFinish={onFinish}
        selectedBridge={{
          id: "br_1",
          bridge_code: "B-001",
          bridge_name: "Bridge 1",
        } as never}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下一步流程" }));

    const submit = screen.getByRole("button", { name: "立即启动云端扫描" });
    expect(submit).toBeDisabled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
