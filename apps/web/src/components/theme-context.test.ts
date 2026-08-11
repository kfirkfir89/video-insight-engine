import { describe, it, expect, afterEach, vi } from "vitest";

import { resolveTheme } from "./theme-context";

describe("resolveTheme", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("should return 'lagoon' when given the lagoon theme", () => {
    expect(resolveTheme("lagoon")).toBe("lagoon");
  });

  it("should pass through 'light' unchanged", () => {
    expect(resolveTheme("light")).toBe("light");
  });

  it("should pass through 'dark' unchanged", () => {
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("should resolve 'system' to 'light' when the OS prefers light", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(resolveTheme("system")).toBe("light");
  });

  it("should resolve 'system' to 'dark' when the OS prefers dark", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(resolveTheme("system")).toBe("dark");
  });
});
