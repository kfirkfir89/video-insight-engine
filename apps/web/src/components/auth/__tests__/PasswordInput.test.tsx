import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PasswordInput } from "../PasswordInput";

describe("PasswordInput", () => {
  it("masks the value by default", () => {
    render(<PasswordInput placeholder="Password" />);
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("starts with the toggle in the unpressed 'show' state", () => {
    render(<PasswordInput placeholder="Password" />);
    const toggle = screen.getByRole("button", { name: /show password/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("reveals and re-hides the value when the toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" />);
    const input = screen.getByPlaceholderText("Password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");
    const hideToggle = screen.getByRole("button", { name: /hide password/i });
    expect(hideToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(hideToggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("forwards input props to the underlying field", () => {
    render(
      <PasswordInput
        id="pw"
        placeholder="Password"
        autoComplete="current-password"
      />,
    );
    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("id", "pw");
    expect(input).toHaveAttribute("autocomplete", "current-password");
  });
});
