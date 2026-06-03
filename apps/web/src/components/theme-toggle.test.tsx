import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ThemeContext, type Theme } from "./theme-context";
import { ThemeToggle } from "./theme-toggle";

function renderToggle(theme: Theme) {
  const setTheme = vi.fn();
  render(
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ThemeToggle />
    </ThemeContext.Provider>,
  );
  return { setTheme };
}

describe("ThemeToggle", () => {
  it("should advance from 'system' to 'lagoon' when clicked", () => {
    const { setTheme } = renderToggle("system");
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("lagoon");
  });

  it("should wrap from 'lagoon' back to 'dark' when clicked", () => {
    const { setTheme } = renderToggle("lagoon");
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("should expose a 'Lagoon' aria-label when the lagoon theme is active", () => {
    renderToggle("lagoon");
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain(
      "Lagoon",
    );
  });
});
