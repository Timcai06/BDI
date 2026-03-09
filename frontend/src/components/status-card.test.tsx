import React from "react";
import { render, screen } from "@testing-library/react";

import { StatusCard } from "@/components/status-card";

describe("StatusCard", () => {
  it("renders the user-facing phase label and message", () => {
    render(<StatusCard phase="running" message="后端已接收任务，正在执行推理。" />);

    expect(screen.getByText("INFERENCE")).toBeInTheDocument();
    expect(screen.getByText("后端已接收任务，正在执行推理。")).toBeInTheDocument();
  });
});
