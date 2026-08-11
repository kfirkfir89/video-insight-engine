import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DegradedNotice } from "@/features/video-output/components/DegradedNotice";

describe("DegradedNotice", () => {
  it("should render the partial-result message as a status region", () => {
    render(<DegradedNotice onRetry={() => {}} />);

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(/partial result/i);
    expect(region).toHaveTextContent(/retry/i);
  });

  it("should call onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<DegradedNotice onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should disable the retry button while retrying", () => {
    render(<DegradedNotice onRetry={() => {}} retrying />);

    expect(screen.getByRole("button", { name: /retry/i })).toBeDisabled();
  });
});
